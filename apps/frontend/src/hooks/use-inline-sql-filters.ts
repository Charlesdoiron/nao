import { useEffect, useRef, useState } from 'react';
import { isFilterSelectionActive, renderFilterSqlValue } from '@nao/shared/sql-template';
import type { Monaco } from '@monaco-editor/react';
import type { StoryFilterSelections, StoryFilterType } from '@nao/shared/sql-template';
import type { ParsedFilterBlock } from '@nao/shared/story-segments';
import type { editor } from 'monaco-editor';

import type { SqlFilterBlock, SqlFilterTemplateAnalysis, SqlFilterToken } from '@/lib/sql-filter-template';

const MARKER_OWNER = 'nao-sql-filters';
const CHIP_CLASS = 'nao-sql-filter-chip';
const CHIP_FILTER_CLASS_PREFIX = 'nao-sql-filter-ref-';
const MAX_VALUE_PREVIEW_LENGTH = 36;

const VALUE_HINTS: Record<StoryFilterType, string> = {
	select: 'value',
	multi_select: 'values',
	search: '%text%',
	date_range: 'start AND end',
};

export interface SqlFilterChipClick {
	filterId: string;
	rect: DOMRect;
}

interface UseInlineSqlFiltersOptions {
	editor: editor.IStandaloneCodeEditor | null;
	monaco: Monaco | null;
	analysis: SqlFilterTemplateAnalysis;
	filtersById: Map<string, ParsedFilterBlock>;
	selections: StoryFilterSelections;
	showJinja: boolean;
	enabled: boolean;
	onChipClick: (click: SqlFilterChipClick) => void;
}

/**
 * Renders story filter Jinja as inline chips inside a Monaco SQL editor: valid `{% filter %}` blocks
 * collapse into a labelled chip, their `.sql` placeholder shows the test value that will be injected,
 * and invalid expressions stay visible with an error squiggle. Tokens touched by the selection
 * are revealed so the raw template remains editable.
 */
export function useInlineSqlFilters({
	editor: editorInstance,
	monaco,
	analysis,
	filtersById,
	selections,
	showJinja,
	enabled,
	onChipClick,
}: UseInlineSqlFiltersOptions) {
	const selectionRange = useEditorSelectionOffsets(editorInstance);
	const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
	const onChipClickRef = useRef(onChipClick);
	onChipClickRef.current = onChipClick;

	useEffect(() => {
		const model = editorInstance?.getModel();
		if (!editorInstance || !model) {
			return;
		}
		decorationsRef.current ??= editorInstance.createDecorationsCollection();
		decorationsRef.current.set(
			enabled && !showJinja
				? buildDecorations(model, analysis, filtersById, selections, selectionRange)
				: buildRevealedDecorations(model, analysis, filtersById),
		);
	}, [editorInstance, analysis, filtersById, selections, showJinja, enabled, selectionRange]);

	useEffect(() => {
		const model = editorInstance?.getModel();
		if (!monaco || !model) {
			return;
		}
		monaco.editor.setModelMarkers(model, MARKER_OWNER, enabled ? buildMarkers(monaco, model, analysis) : []);
	}, [monaco, editorInstance, analysis, enabled]);

	useEffect(() => {
		const domNode = editorInstance?.getDomNode();
		if (!domNode) {
			return;
		}
		const handleMouseDown = (event: MouseEvent) => {
			const chip = event.target instanceof Element ? event.target.closest(`.${CHIP_CLASS}`) : null;
			const filterId = chip ? readChipFilterId(chip) : null;
			if (!chip || !filterId) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			onChipClickRef.current({ filterId, rect: chip.getBoundingClientRect() });
		};
		domNode.addEventListener('mousedown', handleMouseDown, true);
		return () => domNode.removeEventListener('mousedown', handleMouseDown, true);
	}, [editorInstance]);
}

export function formatFilterValuePreview(
	filterType: StoryFilterType,
	selection: StoryFilterSelections[string] | undefined,
): string | null {
	if (!isFilterSelectionActive(filterType, selection)) {
		return null;
	}
	const value = renderFilterSqlValue(filterType, selection) ?? '';
	return value.length > MAX_VALUE_PREVIEW_LENGTH ? `${value.slice(0, MAX_VALUE_PREVIEW_LENGTH - 1)}…` : value;
}

function useEditorSelectionOffsets(editorInstance: editor.IStandaloneCodeEditor | null): [number, number] | null {
	const [range, setRange] = useState<[number, number] | null>(null);

	useEffect(() => {
		if (!editorInstance) {
			return;
		}
		const update = () => {
			const model = editorInstance.getModel();
			const selection = editorInstance.getSelection();
			if (!model || !selection || !editorInstance.hasTextFocus()) {
				setRange(null);
				return;
			}
			const start = model.getOffsetAt(selection.getStartPosition());
			const end = model.getOffsetAt(selection.getEndPosition());
			setRange((current) => (current?.[0] === start && current[1] === end ? current : [start, end]));
		};
		const disposables = [
			editorInstance.onDidChangeCursorSelection(update),
			editorInstance.onDidFocusEditorText(update),
			editorInstance.onDidBlurEditorText(update),
		];
		return () => disposables.forEach((disposable) => disposable.dispose());
	}, [editorInstance]);

	return range;
}

function buildDecorations(
	model: editor.ITextModel,
	analysis: SqlFilterTemplateAnalysis,
	filtersById: Map<string, ParsedFilterBlock>,
	selections: StoryFilterSelections,
	selectionRange: [number, number] | null,
): editor.IModelDeltaDecoration[] {
	const decorations: editor.IModelDeltaDecoration[] = [];

	for (const block of analysis.blocks) {
		if (block.hasIssue) {
			continue;
		}
		const filter = filtersById.get(block.filterId);
		const isActive = filter ? isFilterSelectionActive(filter.filterType, selections[block.filterId]) : false;
		decorations.push({
			range: offsetsToRange(model, block.innerStart, block.innerEnd),
			options: {
				inlineClassName: isActive
					? 'nao-sql-filter-clause'
					: 'nao-sql-filter-clause nao-sql-filter-clause--idle',
			},
		});
	}

	for (const token of analysis.tokens) {
		const block = token.blockIndex !== undefined ? analysis.blocks[token.blockIndex] : undefined;
		if (!block || block.hasIssue || token.issue || isTokenTouched(token, selectionRange)) {
			continue;
		}
		decorations.push(buildChipDecoration(model, token, block, filtersById, selections));
	}

	return decorations;
}

function buildRevealedDecorations(
	model: editor.ITextModel,
	analysis: SqlFilterTemplateAnalysis,
	filtersById: Map<string, ParsedFilterBlock>,
): editor.IModelDeltaDecoration[] {
	return analysis.tokens
		.filter((token) => !token.issue && token.filterId && filtersById.has(token.filterId))
		.map((token) => ({
			range: offsetsToRange(model, token.start, token.end),
			options: { inlineClassName: 'nao-sql-jinja-token' },
		}));
}

function buildChipDecoration(
	model: editor.ITextModel,
	token: SqlFilterToken,
	block: SqlFilterBlock,
	filtersById: Map<string, ParsedFilterBlock>,
	selections: StoryFilterSelections,
): editor.IModelDeltaDecoration {
	const filter = filtersById.get(block.filterId);
	const isActive = filter ? isFilterSelectionActive(filter.filterType, selections[block.filterId]) : false;
	const stateClass = isActive ? 'nao-sql-filter-chip--active' : 'nao-sql-filter-chip--idle';
	const classes = [CHIP_CLASS, `nao-sql-filter-chip--${token.kind}`, stateClass, chipFilterClass(block.filterId)];
	const hiddenRange = {
		range: offsetsToRange(model, token.start, token.end),
		options: { inlineClassName: 'nao-sql-jinja-hidden', inlineClassNameAffectsLetterSpacing: true },
	};

	if (token.kind === 'close') {
		return hiddenRange;
	}
	return {
		...hiddenRange,
		options: {
			...hiddenRange.options,
			before: {
				content: describeChip(token, block.filterId, filter, selections),
				inlineClassName: classes.join(' '),
				inlineClassNameAffectsLetterSpacing: true,
			},
		},
	};
}

function describeChip(
	token: SqlFilterToken,
	filterId: string,
	filter: ParsedFilterBlock | undefined,
	selections: StoryFilterSelections,
): string {
	if (token.kind === 'open') {
		return filter?.label ?? filterId;
	}
	if (!filter) {
		return filterId;
	}
	return formatFilterValuePreview(filter.filterType, selections[filterId]) ?? VALUE_HINTS[filter.filterType];
}

function buildMarkers(
	monaco: Monaco,
	model: editor.ITextModel,
	analysis: SqlFilterTemplateAnalysis,
): editor.IMarkerData[] {
	return analysis.issues.map((token) => {
		const range = offsetsToRange(model, token.start, token.end);
		return {
			...range,
			severity: monaco.MarkerSeverity.Error,
			message: token.issue ?? '',
			source: 'story filters',
		};
	});
}

function isTokenTouched(token: SqlFilterToken, selectionRange: [number, number] | null): boolean {
	if (!selectionRange) {
		return false;
	}
	const [start, end] = selectionRange;
	if (start === end) {
		return start > token.start && start < token.end;
	}
	return start < token.end && end > token.start;
}

function offsetsToRange(model: editor.ITextModel, start: number, end: number) {
	const startPosition = model.getPositionAt(start);
	const endPosition = model.getPositionAt(end);
	return {
		startLineNumber: startPosition.lineNumber,
		startColumn: startPosition.column,
		endLineNumber: endPosition.lineNumber,
		endColumn: endPosition.column,
	};
}

function chipFilterClass(filterId: string): string {
	return `${CHIP_FILTER_CLASS_PREFIX}${filterId}`;
}

function readChipFilterId(chip: Element): string | null {
	const filterClass = [...chip.classList].find((name) => name.startsWith(CHIP_FILTER_CLASS_PREFIX));
	return filterClass ? filterClass.slice(CHIP_FILTER_CLASS_PREFIX.length) : null;
}
