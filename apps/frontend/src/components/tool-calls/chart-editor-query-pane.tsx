import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sqlIncludesFilterTemplate } from '@nao/shared/sql-template';
import { ChartEditorFiltersPanel } from './chart-editor-filters-panel';
import type { Monaco } from '@monaco-editor/react';
import type { ParsedFilterBlock } from '@nao/shared/story-segments';
import type { executeSql } from '@nao/shared/tools';
import type { editor } from 'monaco-editor';
import type { StoryFilterApi } from '@/hooks/use-story-filters';
import type { FilterBlockUsage, SqlFilterLint } from '@/lib/sql-filter-lint';

import { SqlQueryEditor } from '@/components/side-panel/sql-editor';
import { Button } from '@/components/ui/button';
import { ResizablePanel, ResizablePanelGroup, ResizableSeparator } from '@/components/ui/resizable';
import { insertFilterSnippet, lintSqlFilters } from '@/lib/sql-filter-lint';
import { cn } from '@/lib/utils';

const SQL_PANEL_MIN_WIDTH = 360;
const FILTERS_PANEL_DEFAULT_WIDTH = 460;
const FILTERS_PANEL_MIN_WIDTH = 360;
const FILTERS_PANEL_MAX_WIDTH = 720;
const LINT_MARKER_OWNER = 'nao-story-filters';
const PANEL_OVERFLOW_HIDDEN = { overflow: 'hidden' } as const;
const EMPTY_FILTERS: ParsedFilterBlock[] = [];
const EMPTY_USAGES: FilterBlockUsage[] = [];

interface ChartEditorQueryPaneProps {
	input: executeSql.Input;
	output: executeSql.Output;
	toolCallId?: string;
	storyFilters?: ParsedFilterBlock[];
	storyFilterApi?: StoryFilterApi;
	onOutputChange: (output: executeSql.Output) => void;
	onClose: () => void;
	className?: string;
}

interface EditorHandle {
	instance: editor.IStandaloneCodeEditor;
	monaco: Monaco;
}

/**
 * Chart space of the chart editor while the source query is being edited. Stories with filters get a
 * split workspace: the SQL on the left and a Filters panel to lint and test the filter templates.
 */
export function ChartEditorQueryPane({
	input,
	output,
	toolCallId,
	storyFilters,
	storyFilterApi,
	onOutputChange,
	onClose,
	className,
}: ChartEditorQueryPaneProps) {
	const [sql, setSql] = useState(input.sql_query);
	const [latestOutput, setLatestOutput] = useState(output);
	const [editorHandle, setEditorHandle] = useState<EditorHandle | null>(null);
	const [focusedFilterId, setFocusedFilterId] = useState<string | null>(null);
	const filters = storyFilters ?? EMPTY_FILTERS;
	const showFiltersWorkspace = storyFilters !== undefined && (filters.length > 0 || sqlIncludesFilterTemplate(sql));
	const lint = useMemo(() => lintSqlFilters(sql, filters), [sql, filters]);
	const workspaceLint = showFiltersWorkspace ? lint : null;
	const workspaceUsages = workspaceLint?.usages ?? EMPTY_USAGES;

	useLintMarkers(editorHandle, workspaceLint);
	useFilterBlockHighlight(editorHandle, workspaceUsages, focusedFilterId);
	useFocusFilterOnClick(editorHandle, workspaceUsages, setFocusedFilterId);

	const handleOutputChange = useCallback(
		(next: executeSql.Output) => {
			setLatestOutput(next);
			onOutputChange(next);
		},
		[onOutputChange],
	);

	const handleEditorMount = useCallback((instance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
		setEditorHandle({ instance, monaco });
	}, []);

	const revealRange = useCallback(
		(start: number, end: number) => {
			const model = editorHandle?.instance.getModel();
			if (!editorHandle || !model) {
				return;
			}
			const range = toMonacoRange(editorHandle.monaco, model, start, end);
			editorHandle.instance.setSelection(range);
			editorHandle.instance.revealRangeInCenterIfOutsideViewport(range);
			editorHandle.instance.focus();
		},
		[editorHandle],
	);

	const handleRevealUsage = useCallback(
		(usage: FilterBlockUsage) => revealRange(usage.start, usage.end),
		[revealRange],
	);

	const handleInsertFilter = useCallback(
		(filter: ParsedFilterBlock) => {
			const model = editorHandle?.instance.getModel();
			if (!editorHandle || !model) {
				return;
			}
			const next = insertFilterSnippet(model.getValue(), filter);
			editorHandle.instance.executeEdits(LINT_MARKER_OWNER, [
				{ range: model.getFullModelRange(), text: next.sql },
			]);
			setFocusedFilterId(filter.id);
			revealRange(next.start, next.end);
		},
		[editorHandle, revealRange],
	);

	const sqlEditor = (
		<SqlQueryEditor
			input={input}
			output={output}
			toolCallId={toolCallId}
			editable
			onOutputChange={handleOutputChange}
			onSqlChange={setSql}
			onEditorMount={handleEditorMount}
			showTemplateWarnings={!showFiltersWorkspace}
		/>
	);

	return (
		<div className={cn('flex min-h-0 flex-1 flex-col', className)}>
			<div className='flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4'>
				<span className='text-sm font-semibold text-foreground'>Query editor</span>
				<Button type='button' variant='ghost' size='sm' className='h-7 rounded-full text-xs' onClick={onClose}>
					<ArrowLeft className='size-3.5' /> Back to chart
				</Button>
			</div>
			{showFiltersWorkspace ? (
				<ResizablePanelGroup orientation='horizontal' className='min-h-0 flex-1'>
					<ResizablePanel
						id='query-sql'
						minSize={SQL_PANEL_MIN_WIDTH}
						className='flex flex-col'
						style={PANEL_OVERFLOW_HIDDEN}
					>
						{sqlEditor}
					</ResizablePanel>
					<ResizableSeparator />
					<ResizablePanel
						id='query-filters'
						defaultSize={FILTERS_PANEL_DEFAULT_WIDTH}
						minSize={FILTERS_PANEL_MIN_WIDTH}
						maxSize={FILTERS_PANEL_MAX_WIDTH}
						className='flex flex-col'
						style={PANEL_OVERFLOW_HIDDEN}
					>
						<ChartEditorFiltersPanel
							sql={sql}
							filters={filters}
							lint={lint}
							output={latestOutput}
							queryId={output.id}
							filterApi={storyFilterApi}
							focusedFilterId={focusedFilterId}
							onFocusFilter={setFocusedFilterId}
							onRevealUsage={handleRevealUsage}
							onInsertFilter={handleInsertFilter}
						/>
					</ResizablePanel>
				</ResizablePanelGroup>
			) : (
				sqlEditor
			)}
		</div>
	);
}

function useLintMarkers(handle: EditorHandle | null, lint: SqlFilterLint | null) {
	useEffect(() => {
		const model = handle?.instance.getModel();
		if (!handle || !model) {
			return;
		}
		const markers = (lint?.issues ?? []).flatMap((issue) => {
			if (issue.start === undefined || issue.end === undefined) {
				return [];
			}
			const range = toMonacoRange(handle.monaco, model, issue.start, issue.end);
			const severity =
				issue.severity === 'error' ? handle.monaco.MarkerSeverity.Error : handle.monaco.MarkerSeverity.Warning;
			return [{ ...range, severity, message: issue.message, source: 'Story filters' }];
		});
		handle.monaco.editor.setModelMarkers(model, LINT_MARKER_OWNER, markers);
		return () => handle.monaco.editor.setModelMarkers(model, LINT_MARKER_OWNER, []);
	}, [handle, lint]);
}

function useFilterBlockHighlight(
	handle: EditorHandle | null,
	usages: FilterBlockUsage[],
	focusedFilterId: string | null,
) {
	useEffect(() => {
		const model = handle?.instance.getModel();
		if (!handle || !model || usages.length === 0) {
			return;
		}
		const collection = handle.instance.createDecorationsCollection(
			usages.map((usage) => ({
				range: toMonacoRange(handle.monaco, model, usage.start, usage.end),
				options: {
					className:
						usage.filterId === focusedFilterId
							? 'sql-filter-block sql-filter-block--focused'
							: 'sql-filter-block',
					hoverMessage: { value: `Story filter \`${usage.filterId}\`, see the Filters panel` },
				},
			})),
		);
		return () => collection.clear();
	}, [handle, usages, focusedFilterId]);
}

function useFocusFilterOnClick(
	handle: EditorHandle | null,
	usages: FilterBlockUsage[],
	onFocusFilter: (filterId: string) => void,
) {
	const usagesRef = useRef(usages);
	usagesRef.current = usages;

	useEffect(() => {
		if (!handle) {
			return;
		}
		const disposable = handle.instance.onDidChangeCursorPosition((event) => {
			const model = handle.instance.getModel();
			if (event.source !== 'mouse' || !model) {
				return;
			}
			const offset = model.getOffsetAt(event.position);
			const usage = usagesRef.current.find(({ start, end }) => offset >= start && offset <= end);
			if (usage) {
				onFocusFilter(usage.filterId);
			}
		});
		return () => disposable.dispose();
	}, [handle, onFocusFilter]);
}

function toMonacoRange(monaco: Monaco, model: editor.ITextModel, start: number, end: number) {
	const from = model.getPositionAt(start);
	const to = model.getPositionAt(end);
	return new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column);
}
