import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Editor, useMonaco } from '@monaco-editor/react';
import {
	extractSqlFilterIds,
	isFilterSelectionActive,
	renderSqlTemplate,
	stripSqlFilterBlocks,
} from '@nao/shared/sql-template';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Braces, Filter, Loader2, Play, Save } from 'lucide-react';
import { usePanelRef } from 'react-resizable-panels';
import { ResizableSeparator, ResizablePanel, ResizablePanelGroup } from '../ui/resizable';
import type { Monaco } from '@monaco-editor/react';
import type { UIMessage } from '@nao/backend/chat';
import type { StoryFilterSelection, StoryFilterSelections } from '@nao/shared/sql-template';
import type { ParsedFilterBlock } from '@nao/shared/story-segments';
import type { executeSql } from '@nao/shared/tools';
import type { editor } from 'monaco-editor';

import type { SqlFilterPopoverTarget } from '@/components/side-panel/sql-filter-popover';
import type { StoryFilterApi } from '@/hooks/use-story-filters';
import type { SqlFilterBlock, SqlFilterToken } from '@/lib/sql-filter-template';
import { useOptionalAgentContext } from '@/contexts/agent.provider';
import { useEditorTheme } from '@/hooks/use-editor-theme';
import { useInlineSqlFilters } from '@/hooks/use-inline-sql-filters';
import { useQueryRowsSource, useServerPaginatedRows } from '@/hooks/use-query-rows';
import { FixInChatButton } from '@/components/fix-in-chat-button';
import { SidePanelHeader } from '@/components/side-panel/side-panel-header';
import { SqlFilterPopover } from '@/components/side-panel/sql-filter-popover';
import { SqlFilterTestBar } from '@/components/side-panel/sql-filter-test-bar';
import { TableDisplay } from '@/components/tool-calls/display-table';
import { Button } from '@/components/ui/button';
import { applyExecuteSqlResultToMessages } from '@/lib/execute-sql-messages';
import { analyzeSqlFilterTemplate, buildFilterBlockSnippet, findFilterInsertOffset } from '@/lib/sql-filter-template';
import { formatSQL } from '@/lib/sql-formatter';
import { SQL_SHIKI_THEME, setupSqlHighlighting } from '@/lib/sql-shiki-theme';
import { cn } from '@/lib/utils';
import { trpc } from '@/main';

const RESULTS_MIN_HEIGHT = 240;
const SQL_MIN_HEIGHT = 100;
const SEPARATOR_HEIGHT = 12;
const SQL_CONTENT_PADDING = 8;
const RESULTS_PAGE_SIZE = 100;
const EMPTY_FILTERS: ParsedFilterBlock[] = [];
const EMPTY_SELECTIONS: StoryFilterSelections = {};

interface SqlEditorProps {
	input: executeSql.Input;
	output: executeSql.Output;
	toolCallId?: string;
	editable?: boolean;
}

export const SidePanelContent = ({ input, output, toolCallId, editable = false }: SqlEditorProps) => {
	return (
		<div className='flex h-full min-h-0 flex-col bg-background'>
			<SidePanelHeader title={input.name ?? input.sql_query} label={output.id} />
			<SqlQueryEditor input={input} output={output} toolCallId={toolCallId} editable={editable} />
		</div>
	);
};

interface SqlQueryEditorProps extends SqlEditorProps {
	onOutputChange?: (output: executeSql.Output) => void;
	storyFilters?: ParsedFilterBlock[];
	initialFilterSelections?: StoryFilterSelections;
	filterApi?: StoryFilterApi | null;
}

/** SQL editor with run / save & run actions and the result table underneath. */
export function SqlQueryEditor({
	input,
	output,
	toolCallId,
	editable = false,
	onOutputChange,
	storyFilters,
	initialFilterSelections = EMPTY_SELECTIONS,
	filterApi,
}: SqlQueryEditorProps) {
	const queryClient = useQueryClient();
	const monaco = useMonaco();
	const editorTheme = useEditorTheme();
	const [shikiReady, setShikiReady] = useState(false);
	const agent = useOptionalAgentContext();
	const agentRef = useRef(agent);
	agentRef.current = agent;
	const queryId = output.id;
	const [sqlQuery, setSqlQuery] = useState(input.sql_query);
	const [savedSql, setSavedSql] = useState(input.sql_query);
	const [previewOutput, setPreviewOutput] = useState<executeSql.Output>(output);
	const [error, setError] = useState<string | null>(null);
	const rowsSource = useQueryRowsSource(toolCallId, previewOutput);
	const resultRows = useServerPaginatedRows(
		rowsSource,
		previewOutput.data as Record<string, unknown>[],
		RESULTS_PAGE_SIZE,
	);
	const [testSelections, setTestSelections] = useState<StoryFilterSelections>(initialFilterSelections);
	const [testedFilterLabels, setTestedFilterLabels] = useState<string[]>([]);
	const [showJinja, setShowJinja] = useState(false);
	const [filterPopover, setFilterPopover] = useState<SqlFilterPopoverTarget | null>(null);
	const [editorInstance, setEditorInstance] = useState<editor.IStandaloneCodeEditor | null>(null);
	const rootRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
	const sqlPanelRef = usePanelRef();
	const groupElementRef = useRef<HTMLDivElement>(null);
	const sqlQueryRef = useRef(sqlQuery);
	sqlQueryRef.current = sqlQuery;
	const onOutputChangeRef = useRef(onOutputChange);
	onOutputChangeRef.current = onOutputChange;

	useEffect(() => {
		if (!monaco) {
			return;
		}
		let active = true;
		setupSqlHighlighting(monaco).then(() => {
			if (active) {
				setShikiReady(true);
			}
		});
		return () => {
			active = false;
		};
	}, [monaco]);

	const themeName = shikiReady
		? editorTheme === 'vs-dark'
			? SQL_SHIKI_THEME.dark
			: SQL_SHIKI_THEME.light
		: editorTheme;

	useEffect(() => {
		setSqlQuery(input.sql_query);
		setSavedSql(input.sql_query);
		setPreviewOutput(output);
		setError(null);
		setTestSelections(initialFilterSelections);
		setTestedFilterLabels([]);
		setFilterPopover(null);
	}, [queryId]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only when switching queries

	const canEdit = Boolean(editable && queryId && !agent?.isReadonly);
	const isDirty = sqlQuery !== savedSql;
	const declaredFilters = storyFilters ?? EMPTY_FILTERS;
	const filtersById = useMemo(() => new Map(declaredFilters.map((filter) => [filter.id, filter])), [declaredFilters]);
	const filterAnalysis = useMemo(
		() => analyzeSqlFilterTemplate(sqlQuery, storyFilters ? { knownFilterIds: filtersById.keys() } : undefined),
		[sqlQuery, storyFilters, filtersById],
	);
	const validationIssues = canEdit ? filterAnalysis.issues : [];
	const showFilterControls = canEdit && (declaredFilters.length > 0 || filterAnalysis.tokens.length > 0);
	const activeTestFilters = declaredFilters.filter(
		(filter) =>
			filterAnalysis.referencedFilterIds.includes(filter.id) &&
			isFilterSelectionActive(filter.filterType, testSelections[filter.id]),
	);

	useInlineSqlFilters({
		editor: editorInstance,
		monaco,
		analysis: filterAnalysis,
		filtersById,
		selections: testSelections,
		showJinja,
		enabled: canEdit,
		onChipClick: setFilterPopover,
	});

	const previewMutation = useMutation(trpc.sql.previewQuery.mutationOptions());
	const saveMutation = useMutation(trpc.sql.updateQuery.mutationOptions());
	const isBusy = previewMutation.isPending || saveMutation.isPending;
	const isBusyRef = useRef(isBusy);
	isBusyRef.current = isBusy;

	const buildMutationInput = useCallback(
		(sql: string) => ({
			queryId: queryId!,
			sql_query: sql,
			database_id: input.database_id ?? undefined,
			name: input.name ?? undefined,
		}),
		[queryId, input.database_id, input.name],
	);

	const beginMutation = useCallback(() => {
		const sql = editorRef.current?.getValue() ?? sqlQueryRef.current;
		if (!queryId || !sql.trim() || isBusyRef.current) {
			return null;
		}
		setSqlQuery(sql);
		setError(null);
		return sql;
	}, [queryId]);

	const handleRun = useCallback(() => {
		const sql = beginMutation();
		if (!sql) {
			return;
		}
		let testRun: { sql: string; filterLabels: string[] };
		try {
			testRun = renderWithTestValues(sql, declaredFilters, testSelections);
		} catch (err) {
			setError(getMutationErrorMessage(err));
			return;
		}
		previewMutation.mutate(buildMutationInput(testRun.sql), {
			onSuccess: (result) => {
				setPreviewOutput(result);
				setError(null);
				setTestedFilterLabels(testRun.filterLabels);
				onOutputChangeRef.current?.(result);
			},
			onError: (err) => setError(getMutationErrorMessage(err)),
		});
	}, [beginMutation, buildMutationInput, previewMutation, declaredFilters, testSelections]);

	const handleSaveAndRun = useCallback(() => {
		const sql = beginMutation();
		if (!sql) {
			return;
		}
		saveMutation.mutate(buildMutationInput(sql), {
			onSuccess: (result) => {
				setPreviewOutput(result.output);
				setSqlQuery(result.input.sql_query);
				setSavedSql(result.input.sql_query);
				setError(null);
				setTestedFilterLabels([]);
				onOutputChangeRef.current?.(result.output);

				const applyUpdate = (messages: UIMessage[]) =>
					applyExecuteSqlResultToMessages(messages, result.output.id, result.input, result.output);

				const currentAgent = agentRef.current;
				if (currentAgent) {
					currentAgent.setMessages((messages) => applyUpdate(messages));
					if (currentAgent.chatId) {
						queryClient.setQueryData(trpc.chat.get.queryKey({ chatId: currentAgent.chatId }), (previous) =>
							previous ? { ...previous, messages: applyUpdate(previous.messages) } : previous,
						);
					}
				}

				queryClient.removeQueries(trpc.chat.getQueryRows.pathFilter());
				void queryClient.invalidateQueries(trpc.story.getQuerySql.pathFilter());
				void queryClient.invalidateQueries(trpc.story.getFilteredQueryData.pathFilter());
				void queryClient.invalidateQueries(trpc.storyShare.getQuerySql.pathFilter());
				void queryClient.invalidateQueries(trpc.storyShare.getFilteredQueryData.pathFilter());
			},
			onError: (err) => setError(getMutationErrorMessage(err)),
		});
	}, [beginMutation, buildMutationInput, saveMutation, queryClient]);

	useEffect(() => {
		if (!canEdit) {
			return;
		}

		const isFocusInsidePanel = (target: EventTarget | null) =>
			target instanceof Node && Boolean(rootRef.current?.contains(target));

		const onKeyDown = (event: KeyboardEvent) => {
			if (!isFocusInsidePanel(event.target)) {
				return;
			}
			const withModifier = (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;
			if (withModifier && event.key.toLowerCase() === 's') {
				event.preventDefault();
				event.stopPropagation();
				handleSaveAndRun();
				return;
			}
			if (withModifier && event.key === 'Enter') {
				event.preventDefault();
				event.stopPropagation();
				handleRun();
			}
		};

		document.addEventListener('keydown', onKeyDown, true);
		return () => document.removeEventListener('keydown', onKeyDown, true);
	}, [canEdit, handleSaveAndRun, handleRun]);

	const fitSqlPanelToContent = useCallback(
		(instance: editor.IStandaloneCodeEditor) => {
			const groupHeight = groupElementRef.current?.clientHeight ?? 0;
			const panel = sqlPanelRef.current;
			if (!panel || groupHeight <= 0) {
				return false;
			}

			instance.layout();
			const contentHeight = instance.getContentHeight() + SQL_CONTENT_PADDING;
			const maxSqlHeight = Math.max(SQL_MIN_HEIGHT, groupHeight - RESULTS_MIN_HEIGHT - SEPARATOR_HEIGHT);
			const sqlHeight = Math.min(Math.max(contentHeight, SQL_MIN_HEIGHT), maxSqlHeight);
			panel.resize(sqlHeight);
			return true;
		},
		[sqlPanelRef],
	);

	const handleEditorMount = useCallback(
		(instance: editor.IStandaloneCodeEditor, _monaco: Monaco) => {
			editorRef.current = instance;
			setEditorInstance(instance);

			let fitted = false;
			const tryFit = () => {
				if (fitted || !fitSqlPanelToContent(instance)) {
					return;
				}
				fitted = true;
				disposable.dispose();
			};
			const disposable = instance.onDidContentSizeChange(tryFit);
			requestAnimationFrame(tryFit);
		},
		[fitSqlPanelToContent],
	);

	const selectInEditor = useCallback((start: number, end: number) => {
		const instance = editorRef.current;
		const model = instance?.getModel();
		if (!instance || !model) {
			return;
		}
		const range = rangeFromOffsets(model, start, end);
		instance.focus();
		instance.setSelection(range);
		instance.revealRangeInCenterIfOutsideViewport(range);
	}, []);

	const replaceInEditor = useCallback((start: number, end: number, text: string) => {
		const instance = editorRef.current;
		const model = instance?.getModel();
		if (!instance || !model) {
			return;
		}
		instance.executeEdits('nao-sql-filters', [
			{ range: rangeFromOffsets(model, start, end), text, forceMoveMarkers: true },
		]);
		instance.pushUndoStop();
	}, []);

	const findBlock = (filterId: string): SqlFilterBlock | undefined => {
		return filterAnalysis.blocks.find((block) => block.filterId === filterId && !block.hasIssue);
	};

	const handleEditFilterJinja = (filterId: string) => {
		const block = findBlock(filterId);
		setFilterPopover(null);
		if (block) {
			selectInEditor(block.start, block.end);
		}
	};

	const handleRemoveFilter = (filterId: string) => {
		const block = findBlock(filterId);
		setFilterPopover(null);
		if (block) {
			replaceInEditor(block.start, block.end, '');
		}
	};

	const handleInsertFilter = (filter: ParsedFilterBlock) => {
		const sql = editorRef.current?.getValue() ?? sqlQuery;
		const offset = findFilterInsertOffset(sql);
		const needsWhere = !/\bwhere\b/i.test(stripSqlFilterBlocks(sql));
		const snippet = buildFilterBlockSnippet(filter.id, filter.column, filter.filterType);
		const previousLine = sql.slice(sql.lastIndexOf('\n', offset - 1) + 1, offset);
		const indent = needsWhere ? '' : (previousLine.match(/^[ \t]*/)?.[0] ?? '');
		replaceInEditor(offset, offset, `${needsWhere ? '\nWHERE 1 = 1' : ''}\n${indent}${snippet}`);
	};

	const handleTestSelectionChange = (filterId: string, selection: StoryFilterSelection) => {
		setTestSelections((current) => ({ ...current, [filterId]: selection }));
	};

	const popoverBlock = filterPopover ? findBlock(filterPopover.filterId) : undefined;

	return (
		<div ref={rootRef} className='flex min-h-0 flex-1 flex-col bg-background'>
			{canEdit && (
				<div className='flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2'>
					<EditorStatus isDirty={isDirty} testedFilterLabels={testedFilterLabels} />
					<div className='flex items-center gap-2'>
						{filterAnalysis.tokens.length > 0 && (
							<Button
								type='button'
								variant='ghost'
								size='sm'
								className={cn('h-8 gap-1.5 text-xs', showJinja && 'bg-accent text-foreground')}
								aria-pressed={showJinja}
								title={
									showJinja ? 'Show filters as inline controls' : 'Show the underlying Jinja template'
								}
								onClick={() => setShowJinja((current) => !current)}
							>
								<Braces className='size-3.5' />
								{showJinja ? 'Hide Jinja' : 'Show Jinja'}
							</Button>
						)}
						<Button
							type='button'
							variant='outline'
							size='sm'
							className='h-8 gap-1.5'
							onClick={handleRun}
							disabled={isBusy || !sqlQuery.trim()}
							title={
								activeTestFilters.length > 0
									? 'Run a preview with the test filter values (nothing is saved)'
									: undefined
							}
						>
							{previewMutation.isPending ? (
								<Loader2 className='size-3.5 animate-spin' />
							) : (
								<Play className='size-3.5' />
							)}
							<span>
								{activeTestFilters.length > 0
									? `Test with ${activeTestFilters.length} ${activeTestFilters.length === 1 ? 'filter' : 'filters'}`
									: 'Run'}
							</span>
							<kbd className='text-[10px] opacity-60 font-sans'>⌘↵</kbd>
						</Button>
						<Button
							type='button'
							size='sm'
							className='h-8 gap-1.5'
							onClick={handleSaveAndRun}
							disabled={isBusy || !sqlQuery.trim()}
						>
							{saveMutation.isPending ? (
								<Loader2 className='size-3.5 animate-spin' />
							) : (
								<Save className='size-3.5' />
							)}
							<span>Save & run</span>
							<kbd className='text-[10px] opacity-60 font-sans'>⌘S</kbd>
						</Button>
					</div>
				</div>
			)}

			{error && (
				<div className='shrink-0 border-b bg-destructive/10 px-4 py-2 text-sm text-destructive'>{error}</div>
			)}
			{showFilterControls && (
				<SqlFilterTestBar
					filters={declaredFilters}
					referencedFilterIds={filterAnalysis.referencedFilterIds}
					selections={testSelections}
					onOpenFilter={setFilterPopover}
					onInsertFilter={handleInsertFilter}
					onClear={() => setTestSelections({})}
				/>
			)}
			{validationIssues.length > 0 && (
				<SqlValidationBanner
					queryId={queryId}
					sql={sqlQuery}
					issues={validationIssues}
					onSelectIssue={(issue) => selectInEditor(issue.start, issue.end)}
				/>
			)}
			<SqlFilterPopover
				target={popoverBlock ? filterPopover : null}
				filter={filterPopover ? filtersById.get(filterPopover.filterId) : undefined}
				clause={popoverBlock ? sqlQuery.slice(popoverBlock.innerStart, popoverBlock.innerEnd) : null}
				selection={filterPopover ? testSelections[filterPopover.filterId] : undefined}
				api={filterApi}
				onSelectionChange={handleTestSelectionChange}
				onClose={() => setFilterPopover(null)}
				onEditJinja={handleEditFilterJinja}
				onRemove={handleRemoveFilter}
			/>

			<ResizablePanelGroup orientation='vertical' className='min-h-0 flex-1' elementRef={groupElementRef}>
				<ResizablePanel
					id='sql'
					minSize={SQL_MIN_HEIGHT}
					panelRef={sqlPanelRef}
					className='relative w-full group'
				>
					<div className='w-full h-full overflow-auto [&_span]:font-mono pl-2'>
						<Editor
							value={canEdit ? sqlQuery : formatSQL(input.sql_query, output.dialect)}
							onChange={canEdit ? (value) => setSqlQuery(value ?? '') : undefined}
							onMount={handleEditorMount}
							language='sql'
							theme={themeName}
							options={{
								readOnly: !canEdit,
								minimap: {
									enabled: false,
								},
								folding: false,
								lineNumbers: canEdit ? 'on' : 'off',
								scrollbar: {
									horizontal: 'hidden',
									vertical: 'hidden',
								},
								scrollBeyondLastLine: false,
								padding: {
									top: 16,
									bottom: 16,
								},
								wordWrap: 'on',
							}}
						/>
					</div>
				</ResizablePanel>

				<ResizableSeparator withHandle />

				<ResizablePanel id='results' defaultSize={RESULTS_MIN_HEIGHT} minSize={RESULTS_MIN_HEIGHT}>
					<TableDisplay
						data={resultRows.rows}
						serverPagination={resultRows.serverPagination}
						columns={previewOutput.columns}
						className='h-full'
						tableContainerClassName='flex-1 rounded-none border-0'
						emptyLabel={resultRows.isLoadingRows ? 'Loading rows...' : 'No rows returned'}
						maxRowsBeforePagination={RESULTS_PAGE_SIZE}
					/>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}

function EditorStatus({ isDirty, testedFilterLabels }: { isDirty: boolean; testedFilterLabels: string[] }) {
	if (testedFilterLabels.length === 0) {
		return (
			<div className='text-xs text-muted-foreground'>
				{isDirty ? 'Unsaved changes' : 'Edit SQL, then run or save'}
			</div>
		);
	}
	return (
		<div className='flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground'>
			<Filter className='size-3 shrink-0 text-primary' />
			<span className='truncate'>
				Previewing with {testedFilterLabels.join(', ')}
				{isDirty ? ' · unsaved changes' : ''}
			</span>
		</div>
	);
}

function SqlValidationBanner({
	queryId,
	sql,
	issues,
	onSelectIssue,
}: {
	queryId: string | undefined;
	sql: string;
	issues: SqlFilterToken[];
	onSelectIssue: (issue: SqlFilterToken) => void;
}) {
	const fixMessage = [
		`I'm seeing SQL template validation warnings${queryId ? ` for query ${queryId}` : ''}:`,
		...issues.map((issue) => `- Line ${lineOfOffset(sql, issue.start)}: ${issue.issue}`),
		'',
		'Please fix the SQL filter template while preserving the query id.',
	].join('\n');

	return (
		<div className='flex shrink-0 items-start justify-between gap-3 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'>
			<div className='min-w-0 flex-1'>
				<div className='flex items-center gap-1.5 font-medium'>
					<AlertTriangle className='size-3.5 shrink-0' />
					<span>
						{issues.length} filter template {issues.length === 1 ? 'error' : 'errors'} — underlined in the
						query
					</span>
				</div>
				<ul className='mt-1 flex flex-col gap-0.5'>
					{issues.slice(0, 5).map((issue) => (
						<li key={`${issue.start}-${issue.issue}`} className='min-w-0'>
							<button
								type='button'
								className='flex w-full min-w-0 items-baseline gap-1.5 text-left hover:underline'
								onClick={() => onSelectIssue(issue)}
							>
								<span className='shrink-0 font-mono opacity-70'>L{lineOfOffset(sql, issue.start)}</span>
								<span className='truncate'>{issue.issue}</span>
							</button>
						</li>
					))}
					{issues.length > 5 && <li className='opacity-70'>and {issues.length - 5} more...</li>}
				</ul>
			</div>
			<FixInChatButton message={fixMessage} className='shrink-0 gap-1.5' />
		</div>
	);
}

/** Resolves the story filter blocks with the editor's test values so a preview reflects the filtered query. */
function renderWithTestValues(
	sql: string,
	filters: ParsedFilterBlock[],
	selections: StoryFilterSelections,
): { sql: string; filterLabels: string[] } {
	const referencedIds = new Set(extractSqlFilterIds(sql));
	const activeFilters = filters.filter(
		(filter) => referencedIds.has(filter.id) && isFilterSelectionActive(filter.filterType, selections[filter.id]),
	);
	if (activeFilters.length === 0) {
		return { sql, filterLabels: [] };
	}
	const types = Object.fromEntries(filters.map((filter) => [filter.id, filter.filterType]));
	const activeSelections = Object.fromEntries(activeFilters.map((filter) => [filter.id, selections[filter.id]]));
	return {
		sql: renderSqlTemplate(sql, activeSelections, types),
		filterLabels: activeFilters.map((filter) => filter.label),
	};
}

function rangeFromOffsets(model: editor.ITextModel, start: number, end: number) {
	const startPosition = model.getPositionAt(start);
	const endPosition = model.getPositionAt(end);
	return {
		startLineNumber: startPosition.lineNumber,
		startColumn: startPosition.column,
		endLineNumber: endPosition.lineNumber,
		endColumn: endPosition.column,
	};
}

function lineOfOffset(sql: string, offset: number): number {
	return sql.slice(0, offset).split('\n').length;
}

function getMutationErrorMessage(err: unknown): string {
	if (err instanceof Error && err.message) {
		return err.message;
	}
	if (err && typeof err === 'object' && 'shape' in err) {
		const shape = (err as { shape?: { message?: string } }).shape;
		if (shape?.message) {
			return shape.message;
		}
	}
	return 'Failed to run query';
}
