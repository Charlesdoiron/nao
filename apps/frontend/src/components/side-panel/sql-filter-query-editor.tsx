import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Editor, useMonaco } from '@monaco-editor/react';
import { AlertCircle, Braces, CheckCircle2, Code, FlaskConical, Loader2, Save } from 'lucide-react';
import type { Monaco } from '@monaco-editor/react';
import type { StoryFilterSelection, StoryFilterSelections } from '@nao/shared/sql-template';
import type { ParsedFilterBlock } from '@nao/shared/story-segments';
import type { executeSql } from '@nao/shared/tools';
import type { editor } from 'monaco-editor';

import type { SqlField, SqlFilterClause, SqlFilterDocument, SqlFilterLintIssue } from '@/lib/sql-filter-clauses';
import { SqlFilterSidebar } from '@/components/side-panel/sql-filter-sidebar';
import { TableDisplay } from '@/components/tool-calls/display-table';
import { Button } from '@/components/ui/button';
import { IconSegmentedToggle } from '@/components/ui/icon-segmented-toggle';
import { ResizablePanel, ResizablePanelGroup, ResizableSeparator } from '@/components/ui/resizable';
import { TabBar } from '@/components/ui/tab-bar';
import { useEditorTheme } from '@/hooks/use-editor-theme';
import {
	OPERATORS_BY_FILTER_TYPE,
	buildClauseCondition,
	buildSqlFilterTemplate,
	compileSqlFilterQuery,
	createClauseKey,
	findFilterMarkers,
	insertFilterMarker,
	lintSqlFilterDocument,
	matchClauseMarkers,
	parseSqlFilterDocument,
	removeFilterMarker,
	renameFilterMarker,
} from '@/lib/sql-filter-clauses';
import { SQL_SHIKI_THEME, setupSqlHighlighting } from '@/lib/sql-shiki-theme';
import { cn } from '@/lib/utils';

const MARKER_OWNER = 'nao-sql-filters';
const RESULTS_PAGE_SIZE = 100;
const SIDEBAR_DEFAULT_WIDTH = 360;
const SIDEBAR_MIN_WIDTH = 300;
const SIDEBAR_MAX_WIDTH = 520;

export interface SqlFilterTestRequest {
	templateSql: string;
	compiledSql: string;
	testValues: StoryFilterSelections;
	clauses: SqlFilterClause[];
}

export interface SqlFilterTestResult {
	columns: string[];
	rows: Record<string, unknown>[];
}

/** Everything the filter-aware SQL editor needs from the story it belongs to. */
export interface SqlFilterEditing {
	storyFilters: ParsedFilterBlock[];
	fields: SqlField[];
	sourceTable?: string;
	initialTestValues?: StoryFilterSelections;
	runTest: (request: SqlFilterTestRequest) => Promise<SqlFilterTestResult>;
	save: (templateSql: string) => Promise<void>;
}

type ViewMode = 'sql' | 'jinja';
type ResultsTab = 'results' | 'compiled';

type TestState =
	| { status: 'idle' }
	| { status: 'running' }
	| { status: 'success'; result: SqlFilterTestResult; compiledSql: string; durationMs: number; applied: string[] }
	| { status: 'error'; title: string; messages: string[]; compiledSql?: string };

interface SqlFilterQueryEditorProps {
	templateSql: string;
	output: executeSql.Output;
	editing: SqlFilterEditing;
	onOutputChange?: (output: executeSql.Output) => void;
}

const VIEW_OPTIONS = [
	{ value: 'sql', label: 'SQL', icon: Code },
	{ value: 'jinja', label: 'Jinja', icon: Braces },
] as const;

/**
 * SQL editor for story queries that use filters: readable SQL with filter markers on the left,
 * structured filter conditions in a sidebar, and a test run with sample filter values underneath.
 */
export function SqlFilterQueryEditor({ templateSql, output, editing, onOutputChange }: SqlFilterQueryEditorProps) {
	const { storyFilters, fields } = editing;
	const [document, setDocument] = useState<SqlFilterDocument>(() => parseSqlFilterDocument(templateSql));
	const [savedTemplate, setSavedTemplate] = useState(templateSql);
	const [testValues, setTestValues] = useState<StoryFilterSelections>(editing.initialTestValues ?? {});
	const [viewMode, setViewMode] = useState<ViewMode>('sql');
	const [testState, setTestState] = useState<TestState>({ status: 'idle' });
	const [resultsTab, setResultsTab] = useState<ResultsTab>('results');
	const [activeClauseKey, setActiveClauseKey] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
	const [isEditorMounted, setIsEditorMounted] = useState(false);
	const documentRef = useRef(document);
	documentRef.current = document;
	const viewModeRef = useRef(viewMode);
	viewModeRef.current = viewMode;
	const monaco = useMonaco();
	const themeName = useSqlTheme(monaco);

	const issues = useMemo(
		() => lintSqlFilterDocument(document, { storyFilters, fields }),
		[document, storyFilters, fields],
	);
	const errors = issues.filter((issue) => issue.severity === 'error');
	const template = useMemo(() => buildSqlFilterTemplate(document), [document]);
	const isDirty = template !== savedTemplate;
	const isBusy = testState.status === 'running' || isSaving;

	const updateClauses = useCallback((update: (clauses: SqlFilterClause[]) => SqlFilterClause[]) => {
		setDocument((current) => ({ ...current, clauses: update(current.clauses) }));
	}, []);

	const handleClauseChange = useCallback(
		(clauseKey: string, patch: Partial<Omit<SqlFilterClause, 'key' | 'filterId'>>) =>
			updateClauses((clauses) =>
				clauses.map((clause) => (clause.key === clauseKey ? { ...clause, ...patch } : clause)),
			),
		[updateClauses],
	);

	const handleFilterIdChange = useCallback(
		(clauseKey: string, filterId: string) => {
			const filterType = storyFilters.find((filter) => filter.id === filterId)?.filterType;
			setDocument((current) => ({
				sql: renameFilterMarker(current, clauseKey, filterId),
				clauses: current.clauses.map((clause) => {
					if (clause.key !== clauseKey) {
						return clause;
					}
					const allowed = filterType ? OPERATORS_BY_FILTER_TYPE[filterType] : [];
					const operator =
						allowed.length && !allowed.includes(clause.operator) ? allowed[0] : clause.operator;
					return { ...clause, filterId, operator };
				}),
			}));
		},
		[storyFilters],
	);

	const handleAddClause = useCallback(
		(filterId: string) => {
			const filter = storyFilters.find((candidate) => candidate.id === filterId);
			const clause: SqlFilterClause = {
				key: createClauseKey(),
				filterId,
				column: guessFilterColumn(filter, fields),
				operator: filter ? OPERATORS_BY_FILTER_TYPE[filter.filterType][0] : '=',
			};
			setDocument((current) => ({
				sql: insertFilterMarker(current.sql, filterId),
				clauses: [...current.clauses, clause],
			}));
			setActiveClauseKey(clause.key);
		},
		[storyFilters, fields],
	);

	const handleRemoveClause = useCallback((clauseKey: string) => {
		setDocument((current) => ({
			sql: removeFilterMarker(current, clauseKey),
			clauses: current.clauses.filter((clause) => clause.key !== clauseKey),
		}));
	}, []);

	const handlePlaceClause = useCallback((clauseKey: string) => {
		setDocument((current) => {
			const clause = current.clauses.find((candidate) => candidate.key === clauseKey);
			return clause ? { ...current, sql: insertFilterMarker(current.sql, clause.filterId) } : current;
		});
		setActiveClauseKey(clauseKey);
	}, []);

	const handleLocateClause = useCallback((clauseKey: string) => {
		setViewMode('sql');
		setActiveClauseKey(clauseKey);
		const instance = editorRef.current;
		const model = instance?.getModel();
		const marker = matchClauseMarkers(documentRef.current).get(clauseKey);
		if (!instance || !model || !marker) {
			return;
		}
		const start = model.getPositionAt(marker.start);
		const end = model.getPositionAt(marker.end);
		instance.setSelection({
			startLineNumber: start.lineNumber,
			startColumn: start.column,
			endLineNumber: end.lineNumber,
			endColumn: end.column,
		});
		instance.revealLineInCenterIfOutsideViewport(start.lineNumber);
		instance.focus();
	}, []);

	/** Monaco also emits a change when the Jinja view swaps the value in, which must not overwrite the readable SQL. */
	const handleSqlChange = useCallback((value: string | undefined) => {
		if (viewModeRef.current !== 'sql') {
			return;
		}
		setDocument((current) => ({ ...current, sql: value ?? '' }));
	}, []);

	const handleTestValueChange = useCallback((filterId: string, selection: StoryFilterSelection) => {
		setTestValues((current) => ({ ...current, [filterId]: selection }));
	}, []);

	const handleTest = useCallback(async () => {
		setResultsTab('results');
		if (errors.length > 0) {
			setTestState({
				status: 'error',
				title: `Fix ${errors.length} filter ${errors.length === 1 ? 'issue' : 'issues'} before testing`,
				messages: errors.map((issue) => describeIssue(issue, document.clauses, storyFilters)),
			});
			return;
		}

		let compiledSql: string;
		try {
			compiledSql = compileSqlFilterQuery(document, storyFilters, testValues);
		} catch (error) {
			setTestState({ status: 'error', title: 'Could not render the query', messages: [getErrorMessage(error)] });
			return;
		}

		setTestState({ status: 'running' });
		const startedAt = performance.now();
		try {
			const result = await editing.runTest({
				templateSql: template,
				compiledSql,
				testValues,
				clauses: document.clauses,
			});
			setTestState({
				status: 'success',
				result,
				compiledSql,
				durationMs: Math.round(performance.now() - startedAt),
				applied: describeAppliedTestValues(document.clauses, storyFilters, testValues),
			});
			onOutputChange?.({ ...output, columns: result.columns, data: result.rows, row_count: result.rows.length });
		} catch (error) {
			setTestState({ status: 'error', title: 'Query failed', messages: [getErrorMessage(error)], compiledSql });
		}
	}, [errors, document, storyFilters, testValues, editing, template, output, onOutputChange]);

	const handleSave = useCallback(async () => {
		if (errors.length > 0 || isBusy) {
			return;
		}
		setIsSaving(true);
		try {
			await editing.save(template);
			setSavedTemplate(template);
		} finally {
			setIsSaving(false);
		}
	}, [errors.length, isBusy, editing, template]);

	const handleEditorMount = useCallback((instance: editor.IStandaloneCodeEditor) => {
		editorRef.current = instance;
		setIsEditorMounted(true);
		instance.onDidChangeCursorPosition((event) => {
			const model = instance.getModel();
			if (!model) {
				return;
			}
			const offset = model.getOffsetAt(event.position);
			const markers = matchClauseMarkers(documentRef.current);
			const hit = [...markers.entries()].find(([, marker]) => offset >= marker.start && offset <= marker.end);
			if (hit) {
				setActiveClauseKey(hit[0]);
			}
		});
	}, []);

	useFilterMarkerDecorations({
		monaco,
		editorInstance: isEditorMounted ? editorRef.current : null,
		document,
		issues,
		storyFilters,
		activeClauseKey,
		enabled: viewMode === 'sql',
	});

	return (
		<div className='flex min-h-0 flex-1 flex-col bg-background'>
			<div className='flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2'>
				<div className='text-xs text-muted-foreground'>
					{isDirty ? 'Unsaved changes' : 'Filters are edited in the sidebar, the SQL stays readable'}
				</div>
				<div className='flex items-center gap-2'>
					<IconSegmentedToggle
						options={VIEW_OPTIONS}
						value={viewMode}
						onValueChange={setViewMode}
						showLabels
					/>
					<Button
						type='button'
						variant='outline'
						size='sm'
						className='h-8 gap-1.5'
						onClick={handleTest}
						disabled={isBusy}
					>
						{testState.status === 'running' ? (
							<Loader2 className='size-3.5 animate-spin' />
						) : (
							<FlaskConical className='size-3.5' />
						)}
						<span>Test query</span>
					</Button>
					<Button
						type='button'
						size='sm'
						className='h-8 gap-1.5'
						onClick={handleSave}
						disabled={isBusy || errors.length > 0 || !isDirty}
						title={errors.length > 0 ? 'Fix filter issues before saving' : undefined}
					>
						{isSaving ? <Loader2 className='size-3.5 animate-spin' /> : <Save className='size-3.5' />}
						<span>Save</span>
					</Button>
				</div>
			</div>

			<ResizablePanelGroup orientation='horizontal' className='min-h-0 flex-1'>
				<ResizablePanel id='sql-and-results' className='flex flex-col'>
					<ResizablePanelGroup orientation='vertical' className='min-h-0 flex-1'>
						<ResizablePanel id='sql' defaultSize='42%' minSize={120} className='relative'>
							{viewMode === 'jinja' && (
								<div className='absolute top-2 right-4 z-10 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground'>
									Read-only: generated from the filter sidebar
								</div>
							)}
							<div className='h-full w-full pl-2 [&_span]:font-mono'>
								<Editor
									value={viewMode === 'sql' ? document.sql : template}
									onChange={handleSqlChange}
									onMount={handleEditorMount}
									language='sql'
									theme={themeName}
									options={{
										readOnly: viewMode === 'jinja',
										minimap: { enabled: false },
										folding: false,
										lineNumbers: 'on',
										scrollBeyondLastLine: false,
										padding: { top: 16, bottom: 16 },
										wordWrap: 'on',
										fixedOverflowWidgets: true,
									}}
								/>
							</div>
						</ResizablePanel>
						<ResizableSeparator withHandle />
						<ResizablePanel id='results' minSize={180} className='flex flex-col'>
							<TestResultsPanel
								state={testState}
								output={output}
								tab={resultsTab}
								onTabChange={setResultsTab}
							/>
						</ResizablePanel>
					</ResizablePanelGroup>
				</ResizablePanel>
				<ResizableSeparator />
				<ResizablePanel
					id='filters'
					defaultSize={SIDEBAR_DEFAULT_WIDTH}
					minSize={SIDEBAR_MIN_WIDTH}
					maxSize={SIDEBAR_MAX_WIDTH}
				>
					<SqlFilterSidebar
						clauses={document.clauses}
						storyFilters={storyFilters}
						fields={fields}
						sourceTable={editing.sourceTable}
						issues={issues}
						testValues={testValues}
						activeClauseKey={activeClauseKey}
						onClauseChange={handleClauseChange}
						onFilterIdChange={handleFilterIdChange}
						onTestValueChange={handleTestValueChange}
						onAddClause={handleAddClause}
						onRemoveClause={handleRemoveClause}
						onPlaceClause={handlePlaceClause}
						onLocateClause={handleLocateClause}
					/>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}

function TestResultsPanel({
	state,
	output,
	tab,
	onTabChange,
}: {
	state: TestState;
	output: executeSql.Output;
	tab: ResultsTab;
	onTabChange: (tab: ResultsTab) => void;
}) {
	if (state.status === 'error') {
		return <TestErrorPanel state={state} />;
	}

	const hasCompiledSql = state.status === 'success';
	const rows = state.status === 'success' ? state.result.rows : (output.data as Record<string, unknown>[]);
	const columns = state.status === 'success' ? state.result.columns : output.columns;

	return (
		<div className='relative flex h-full min-h-0 flex-col'>
			<div className='flex shrink-0 items-center gap-3 border-b px-4'>
				<TabBar
					idBase='sql-filter-results'
					tabs={[
						{ id: 'results', label: 'Results', count: rows.length },
						{
							id: 'compiled',
							label: 'Compiled SQL',
							disabled: !hasCompiledSql,
							disabledReason: 'Run a test first',
						},
					]}
					activeTab={tab}
					onTabChange={onTabChange}
				/>
				<TestStatus state={state} />
			</div>
			{tab === 'compiled' && state.status === 'success' ? (
				<pre className='min-h-0 flex-1 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground'>
					{state.compiledSql.trim()}
				</pre>
			) : (
				<TableDisplay
					data={rows}
					columns={columns}
					className='min-h-0 flex-1'
					tableContainerClassName='flex-1 rounded-none border-0'
					emptyLabel='No rows match these test values'
					maxRowsBeforePagination={RESULTS_PAGE_SIZE}
				/>
			)}
			{state.status === 'running' && (
				<div className='absolute inset-0 top-10 flex items-center justify-center bg-background/60 text-xs text-muted-foreground'>
					<Loader2 className='mr-2 size-4 animate-spin' />
					Running with test values…
				</div>
			)}
		</div>
	);
}

function TestStatus({ state }: { state: TestState }) {
	if (state.status === 'success') {
		return (
			<div className='flex min-w-0 flex-1 items-center gap-2 text-xs'>
				<span className='flex shrink-0 items-center gap-1 font-medium text-green-700 dark:text-green-500'>
					<CheckCircle2 className='size-3.5' />
					Test passed · {state.durationMs} ms
				</span>
				<div className='flex min-w-0 flex-1 items-center gap-1 overflow-hidden'>
					{state.applied.length === 0 ? (
						<span className='text-muted-foreground'>No test values set, filters were skipped</span>
					) : (
						state.applied.map((value) => (
							<span
								key={value}
								className='shrink-0 truncate rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground'
							>
								{value}
							</span>
						))
					)}
				</div>
			</div>
		);
	}
	return (
		<span className='truncate text-xs text-muted-foreground'>
			Last saved results, unfiltered. Set test values in the sidebar, then Test query.
		</span>
	);
}

function TestErrorPanel({ state }: { state: Extract<TestState, { status: 'error' }> }) {
	return (
		<div className='flex h-full min-h-0 flex-col overflow-auto px-4 py-3'>
			<div className='rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5'>
				<div className='flex items-center gap-1.5 text-sm font-medium text-destructive'>
					<AlertCircle className='size-4' />
					{state.title}
				</div>
				<ul className='mt-1.5 flex flex-col gap-1 pl-5.5 text-xs text-destructive/90'>
					{state.messages.map((message) => (
						<li key={message} className='list-disc'>
							{message}
						</li>
					))}
				</ul>
			</div>
			{state.compiledSql && (
				<pre className='mt-3 overflow-auto rounded-lg bg-muted/50 px-3 py-2 font-mono text-xs whitespace-pre-wrap'>
					{state.compiledSql.trim()}
				</pre>
			)}
		</div>
	);
}

function useSqlTheme(monaco: Monaco | null): string {
	const editorTheme = useEditorTheme();
	const [shikiReady, setShikiReady] = useState(false);

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

	if (!shikiReady) {
		return editorTheme;
	}
	return editorTheme === 'vs-dark' ? SQL_SHIKI_THEME.dark : SQL_SHIKI_THEME.light;
}

/** Highlights filter markers as chips and surfaces lint issues as editor squiggles on the matching marker. */
function useFilterMarkerDecorations({
	monaco,
	editorInstance,
	document,
	issues,
	storyFilters,
	activeClauseKey,
	enabled,
}: {
	monaco: Monaco | null;
	editorInstance: editor.IStandaloneCodeEditor | null;
	document: SqlFilterDocument;
	issues: SqlFilterLintIssue[];
	storyFilters: ParsedFilterBlock[];
	activeClauseKey: string | null;
	enabled: boolean;
}) {
	const collectionRef = useRef<editor.IEditorDecorationsCollection | null>(null);

	useEffect(() => {
		const model = editorInstance?.getModel();
		if (!monaco || !editorInstance || !model) {
			return;
		}
		collectionRef.current ??= editorInstance.createDecorationsCollection();
		if (!enabled) {
			collectionRef.current.clear();
			monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
			return;
		}

		const clauseByMarkerStart = new Map(
			[...matchClauseMarkers(document).entries()].map(([clauseKey, marker]) => [marker.start, clauseKey]),
		);
		const decorations: editor.IModelDeltaDecoration[] = [];
		const modelMarkers: editor.IMarkerData[] = [];

		for (const marker of findFilterMarkers(document.sql)) {
			const start = model.getPositionAt(marker.start);
			const end = model.getPositionAt(marker.end);
			const range = new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
			const clauseKey = clauseByMarkerStart.get(marker.start);
			const clause = document.clauses.find((candidate) => candidate.key === clauseKey);
			const markerIssues = clause
				? issues.filter((issue) => issue.clauseKey === clause.key)
				: [{ severity: 'error' as const, message: `No condition for filters.${marker.filterId}.` }];
			const hasError = markerIssues.some((issue) => issue.severity === 'error');

			decorations.push({
				range,
				options: {
					inlineClassName: cn(
						'sql-filter-marker',
						hasError && 'sql-filter-marker--error',
						clauseKey && clauseKey === activeClauseKey && 'sql-filter-marker--active',
					),
					hoverMessage: clause ? { value: describeClauseHover(clause, storyFilters) } : undefined,
				},
			});
			for (const issue of markerIssues) {
				modelMarkers.push({
					...range,
					severity: issue.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
					message: issue.message,
					source: 'story filters',
				});
			}
		}

		collectionRef.current.set(decorations);
		monaco.editor.setModelMarkers(model, MARKER_OWNER, modelMarkers);
	}, [monaco, editorInstance, document, issues, storyFilters, activeClauseKey, enabled]);
}

function describeClauseHover(clause: SqlFilterClause, storyFilters: ParsedFilterBlock[]): string {
	const label = storyFilters.find((filter) => filter.id === clause.filterId)?.label ?? clause.filterId;
	return `**${label}** filter\n\n\`${buildClauseCondition(clause)}\`\n\nEdit it in the Filters sidebar.`;
}

function describeIssue(
	issue: SqlFilterLintIssue,
	clauses: SqlFilterClause[],
	storyFilters: ParsedFilterBlock[],
): string {
	const clause = clauses.find((candidate) => candidate.key === issue.clauseKey);
	if (!clause) {
		return issue.message;
	}
	const label = storyFilters.find((filter) => filter.id === clause.filterId)?.label ?? `filters.${clause.filterId}`;
	return `${label}: ${issue.message}`;
}

function describeAppliedTestValues(
	clauses: SqlFilterClause[],
	storyFilters: ParsedFilterBlock[],
	testValues: StoryFilterSelections,
): string[] {
	return clauses.flatMap((clause) => {
		const filter = storyFilters.find((candidate) => candidate.id === clause.filterId);
		const value = testValues[clause.filterId];
		if (!filter || value === undefined) {
			return [];
		}
		const values = (Array.isArray(value) ? value : [value]).filter((item) => item.trim() !== '');
		if (values.length === 0 || (filter.filterType === 'date_range' && values.length < 2)) {
			return [];
		}
		const formatted = filter.filterType === 'date_range' ? values.join(' → ') : values.join(', ');
		return [`${clause.column || filter.label} ${clause.operator} ${formatted}`];
	});
}

function guessFilterColumn(filter: ParsedFilterBlock | undefined, fields: SqlField[]): string {
	if (!filter) {
		return '';
	}
	const byName = (name: string | undefined) =>
		fields.find((field) => name && field.name.toLowerCase() === name.toLowerCase())?.name;
	const containingId = fields.find((field) => field.name.toLowerCase().includes(filter.id.toLowerCase()))?.name;
	const firstDateField = fields.find((field) => field.type === 'date')?.name;
	return (
		byName(filter.column) ??
		byName(filter.id) ??
		containingId ??
		(filter.filterType === 'date_range' ? firstDateField : undefined) ??
		''
	);
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error && error.message ? error.message : 'Failed to run query';
}
