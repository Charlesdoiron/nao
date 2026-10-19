import {
	AlertTriangle,
	CheckCircle2,
	ChevronDown,
	CircleDashed,
	CornerDownLeft,
	FlaskConical,
	Loader2,
	Play,
	Plus,
	RotateCcw,
	XCircle,
} from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { pluralize } from '@nao/shared';
import { isFilterSelectionActive, renderSqlTemplate } from '@nao/shared/sql-template';
import type { LucideIcon } from 'lucide-react';
import type { StoryFilterSelection, StoryFilterSelections, StoryFilterType } from '@nao/shared/sql-template';
import type { ParsedFilterBlock } from '@nao/shared/story-segments';
import type { executeSql } from '@nao/shared/tools';
import type { StoryFilterApi } from '@/hooks/use-story-filters';
import type { FilterTestRun } from '@/hooks/use-filter-test-runs';
import type { FilterBlockUsage, FilterLintIssue, SqlFilterLint } from '@/lib/sql-filter-lint';
import type { FilterTestResult } from '@/lib/sql-filter-test-run';

import { FixInChatButton } from '@/components/fix-in-chat-button';
import { StoryFilterControl } from '@/components/story-filter-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TabBar, TabPanel } from '@/components/ui/tab-bar';
import { FULL_QUERY_RUN_KEY, useFilterTestRuns } from '@/hooks/use-filter-test-runs';
import { buildFilterSnippet, countIssues, issuesForFilter } from '@/lib/sql-filter-lint';
import { buildFilterTypes, renderFilterClause } from '@/lib/sql-filter-test-run';
import { cn } from '@/lib/utils';

type PanelTab = 'filters' | 'compiled';
type FilterStatus = 'error' | 'warning' | 'ok' | 'unused';

const PREVIEW_ROW_LIMIT = 6;

const FILTER_TYPE_LABELS: Record<StoryFilterType, string> = {
	select: 'Select',
	multi_select: 'Multi select',
	search: 'Search',
	date_range: 'Date range',
};

const STATUS_ICONS: Record<FilterStatus, { icon: LucideIcon; className: string; label: string }> = {
	error: { icon: XCircle, className: 'text-destructive', label: 'Error' },
	warning: { icon: AlertTriangle, className: 'text-amber-500', label: 'Warning' },
	ok: { icon: CheckCircle2, className: 'text-green-600 dark:text-green-500', label: 'Valid' },
	unused: { icon: CircleDashed, className: 'text-muted-foreground', label: 'Not used in this query' },
};

const noop = () => {};

interface ChartEditorFiltersPanelProps {
	sql: string;
	filters: ParsedFilterBlock[];
	lint: SqlFilterLint;
	output: executeSql.Output;
	queryId?: string;
	filterApi?: StoryFilterApi;
	focusedFilterId: string | null;
	onFocusFilter: (filterId: string | null) => void;
	onRevealUsage: (usage: FilterBlockUsage) => void;
	onInsertFilter: (filter: ParsedFilterBlock) => void;
}

/** Right side of the query editor: lint, test values and test runs for the story filters of the query. */
export function ChartEditorFiltersPanel({
	sql,
	filters,
	lint,
	output,
	queryId,
	filterApi,
	focusedFilterId,
	onFocusFilter,
	onRevealUsage,
	onInsertFilter,
}: ChartEditorFiltersPanelProps) {
	const idBase = useId();
	const [activeTab, setActiveTab] = useState<PanelTab>('filters');
	const [testSelections, setTestSelections] = useState<StoryFilterSelections>({});
	const rows = output.data as Record<string, unknown>[];
	const testRuns = useFilterTestRuns({ sql, filters, rows, columns: output.columns });

	const setTestSelection = (filterId: string, selection: StoryFilterSelection) =>
		setTestSelections((current) => ({ ...current, [filterId]: selection }));

	const resetTestValues = () => {
		setTestSelections({});
		testRuns.reset();
	};

	return (
		<aside className='flex h-full min-h-0 flex-col bg-background'>
			<div className='flex shrink-0 items-center justify-between gap-2 border-b pr-3 pl-1'>
				<TabBar
					idBase={idBase}
					activeTab={activeTab}
					onTabChange={setActiveTab}
					tabs={[
						{ id: 'filters', label: 'Filters', count: filters.length },
						{ id: 'compiled', label: 'Compiled SQL' },
					]}
				/>
				<LintSummary lint={lint} />
			</div>
			{activeTab === 'filters' ? (
				<TabPanel idBase={idBase} tabId='filters' className='flex min-h-0 flex-1 flex-col'>
					<FiltersTab
						filters={filters}
						lint={lint}
						queryId={queryId}
						filterApi={filterApi}
						testSelections={testSelections}
						runs={testRuns.runs}
						focusedFilterId={focusedFilterId}
						onFocusFilter={onFocusFilter}
						onRevealUsage={onRevealUsage}
						onInsertFilter={onInsertFilter}
						onTestSelectionChange={setTestSelection}
						onTestFilter={(filterId) =>
							testRuns.run(filterId, { [filterId]: testSelections[filterId] ?? '' })
						}
					/>
					<FullQueryTestFooter
						filters={filters}
						testSelections={testSelections}
						run={testRuns.runs[FULL_QUERY_RUN_KEY]}
						onRun={() => testRuns.run(FULL_QUERY_RUN_KEY, testSelections)}
						onReset={resetTestValues}
					/>
				</TabPanel>
			) : (
				<TabPanel idBase={idBase} tabId='compiled' className='flex min-h-0 flex-1 flex-col'>
					<CompiledSqlTab sql={sql} filters={filters} testSelections={testSelections} />
				</TabPanel>
			)}
		</aside>
	);
}

function LintSummary({ lint }: { lint: SqlFilterLint }) {
	const errors = countIssues(lint.issues, 'error');
	const warnings = countIssues(lint.issues, 'warning');
	if (errors === 0 && warnings === 0) {
		return (
			<Badge variant='success'>
				<CheckCircle2 /> Filters valid
			</Badge>
		);
	}
	return (
		<div className='flex items-center gap-1.5'>
			{errors > 0 && (
				<Badge className='bg-destructive/10 text-destructive'>
					<XCircle /> {formatCount(errors, 'error')}
				</Badge>
			)}
			{warnings > 0 && (
				<Badge variant='context_admin'>
					<AlertTriangle /> {formatCount(warnings, 'warning')}
				</Badge>
			)}
		</div>
	);
}

interface FiltersTabProps {
	filters: ParsedFilterBlock[];
	lint: SqlFilterLint;
	queryId?: string;
	filterApi?: StoryFilterApi;
	testSelections: StoryFilterSelections;
	runs: Record<string, FilterTestRun>;
	focusedFilterId: string | null;
	onFocusFilter: (filterId: string | null) => void;
	onRevealUsage: (usage: FilterBlockUsage) => void;
	onInsertFilter: (filter: ParsedFilterBlock) => void;
	onTestSelectionChange: (filterId: string, selection: StoryFilterSelection) => void;
	onTestFilter: (filterId: string) => void;
}

function FiltersTab({
	filters,
	lint,
	queryId,
	filterApi,
	testSelections,
	runs,
	focusedFilterId,
	onFocusFilter,
	onRevealUsage,
	onInsertFilter,
	onTestSelectionChange,
	onTestFilter,
}: FiltersTabProps) {
	const declaredIds = useMemo(() => new Set(filters.map((filter) => filter.id)), [filters]);
	const queryIssues = lint.issues.filter((issue) => !issue.filterId || !declaredIds.has(issue.filterId));

	return (
		<div className='flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3'>
			<p className='px-1 pb-1 text-xs text-muted-foreground'>
				Filters are declared in the story. Pick test values to check how each block renders and what it returns
				before saving the query.
			</p>
			{queryIssues.length > 0 && <QueryIssuesCallout issues={queryIssues} queryId={queryId} />}
			{filters.map((filter) => (
				<FilterCard
					key={filter.id}
					filter={filter}
					usages={lint.usages.filter((usage) => usage.filterId === filter.id)}
					issues={issuesForFilter(lint, filter.id)}
					filterApi={filterApi}
					testSelection={testSelections[filter.id]}
					run={runs[filter.id]}
					isExpanded={focusedFilterId === filter.id}
					onToggle={() => onFocusFilter(focusedFilterId === filter.id ? null : filter.id)}
					onRevealUsage={onRevealUsage}
					onInsert={() => onInsertFilter(filter)}
					onTestSelectionChange={(selection) => onTestSelectionChange(filter.id, selection)}
					onTest={() => onTestFilter(filter.id)}
				/>
			))}
			{filters.length === 0 && (
				<div className='rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground'>
					This story declares no filters. Add a {'<filter />'} tag to the story to make the query filterable.
				</div>
			)}
		</div>
	);
}

function QueryIssuesCallout({ issues, queryId }: { issues: FilterLintIssue[]; queryId?: string }) {
	const fixMessage = [
		`The story filter template of query ${queryId ?? ''} has issues:`,
		...issues.map((issue) => `- ${issue.message}`),
		'',
		'Please fix the SQL filter template while preserving the query id.',
	].join('\n');

	return (
		<div className='flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs'>
			<div className='flex items-center gap-1.5 font-medium text-destructive'>
				<XCircle className='size-3.5 shrink-0' />
				Query template
			</div>
			<IssueList issues={issues} />
			<FixInChatButton message={fixMessage} className='h-7 gap-1.5 self-start text-xs' />
		</div>
	);
}

interface FilterCardProps {
	filter: ParsedFilterBlock;
	usages: FilterBlockUsage[];
	issues: FilterLintIssue[];
	filterApi?: StoryFilterApi;
	testSelection: StoryFilterSelection | undefined;
	run: FilterTestRun | undefined;
	isExpanded: boolean;
	onToggle: () => void;
	onRevealUsage: (usage: FilterBlockUsage) => void;
	onInsert: () => void;
	onTestSelectionChange: (selection: StoryFilterSelection) => void;
	onTest: () => void;
}

function FilterCard({
	filter,
	usages,
	issues,
	filterApi,
	testSelection,
	run,
	isExpanded,
	onToggle,
	onRevealUsage,
	onInsert,
	onTestSelectionChange,
	onTest,
}: FilterCardProps) {
	const status = getFilterStatus(usages, issues);
	const { icon: StatusIcon, className: statusClassName, label: statusLabel } = STATUS_ICONS[status];

	return (
		<div
			className={cn(
				'rounded-lg border bg-background transition-colors',
				isExpanded ? 'border-primary/40 shadow-sm' : 'hover:border-foreground/20',
			)}
		>
			<button
				type='button'
				onClick={onToggle}
				aria-expanded={isExpanded}
				className='flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left'
			>
				<StatusIcon className={cn('size-4 shrink-0', statusClassName)} aria-label={statusLabel} />
				<div className='min-w-0 flex-1'>
					<div className='flex items-center gap-2'>
						<span className='truncate text-sm font-medium text-foreground'>{filter.label}</span>
						<Badge variant='viewer' className='px-1.5 py-0 text-[10px]'>
							{FILTER_TYPE_LABELS[filter.filterType]}
						</Badge>
					</div>
					<div className='truncate font-mono text-[11px] text-muted-foreground'>
						{filter.id} · {describeFilterSource(filter)}
					</div>
				</div>
				<FilterCardMeta usages={usages} issues={issues} run={run} />
				<ChevronDown
					className={cn(
						'size-4 shrink-0 text-muted-foreground transition-transform',
						isExpanded && 'rotate-180',
					)}
				/>
			</button>
			{isExpanded && (
				<div className='flex flex-col gap-3 border-t px-3 pt-3 pb-3'>
					{usages.length > 0 ? (
						<FilterUsageList filter={filter} usages={usages} onReveal={onRevealUsage} />
					) : (
						<UnusedFilterNotice filter={filter} onInsert={onInsert} />
					)}
					{issues.length > 0 && <IssueList issues={issues} />}
					{usages.length > 0 && (
						<FilterTestSection
							filter={filter}
							usage={usages[0]}
							filterApi={filterApi}
							selection={testSelection}
							run={run}
							canTest={!issues.some((issue) => issue.severity === 'error')}
							onSelectionChange={onTestSelectionChange}
							onTest={onTest}
						/>
					)}
				</div>
			)}
		</div>
	);
}

function FilterCardMeta({
	usages,
	issues,
	run,
}: {
	usages: FilterBlockUsage[];
	issues: FilterLintIssue[];
	run: FilterTestRun | undefined;
}) {
	if (usages.length === 0) {
		return <span className='shrink-0 text-[11px] text-muted-foreground'>Not in query</span>;
	}
	if (issues.length > 0) {
		return (
			<span className='shrink-0 text-[11px] text-muted-foreground'>{formatCount(issues.length, 'issue')}</span>
		);
	}
	if (run?.status === 'done' && !run.result.error) {
		return (
			<span className='shrink-0 text-[11px] text-muted-foreground'>
				{run.result.rows.length}/{run.result.baselineRowCount} rows
			</span>
		);
	}
	return <span className='shrink-0 text-[11px] text-muted-foreground'>Line {usages[0].line}</span>;
}

function FilterUsageList({
	filter,
	usages,
	onReveal,
}: {
	filter: ParsedFilterBlock;
	usages: FilterBlockUsage[];
	onReveal: (usage: FilterBlockUsage) => void;
}) {
	return (
		<FieldSection label='In the query'>
			{usages.map((usage) => (
				<button
					key={usage.start}
					type='button'
					onClick={() => onReveal(usage)}
					className='group flex w-full cursor-pointer items-start gap-2 rounded-md border bg-muted/40 px-2.5 py-2 text-left hover:bg-muted'
					title={`Show the ${filter.label} block in the SQL`}
				>
					<span className='shrink-0 pt-px font-mono text-[11px] text-muted-foreground'>L{usage.line}</span>
					<code className='min-w-0 flex-1 font-mono text-xs break-all text-foreground'>
						<HighlightedClause clause={usage.clause} />
					</code>
					<CornerDownLeft className='size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100' />
				</button>
			))}
		</FieldSection>
	);
}

function HighlightedClause({ clause }: { clause: string }) {
	const parts = clause.split(/(\{\{[^}]*\}\})/g);
	return (
		<>
			{parts.map((part, index) =>
				part.startsWith('{{') ? (
					<span key={index} className='rounded bg-primary/10 px-0.5 text-primary'>
						{part}
					</span>
				) : (
					<span key={index}>{part}</span>
				),
			)}
		</>
	);
}

function UnusedFilterNotice({ filter, onInsert }: { filter: ParsedFilterBlock; onInsert: () => void }) {
	return (
		<FieldSection label='Not used in this query'>
			<p className='text-xs text-muted-foreground'>
				Changing “{filter.label}” will not affect this chart. Insert a filter block to make it apply.
			</p>
			<code className='rounded-md border border-dashed bg-muted/40 px-2.5 py-2 font-mono text-xs break-all text-muted-foreground'>
				{buildFilterSnippet(filter)}
			</code>
			<Button
				type='button'
				size='sm'
				variant='outline'
				className='h-7 gap-1.5 self-start text-xs'
				onClick={onInsert}
			>
				<Plus className='size-3.5' /> Insert into SQL
			</Button>
		</FieldSection>
	);
}

interface FilterTestSectionProps {
	filter: ParsedFilterBlock;
	usage: FilterBlockUsage;
	filterApi?: StoryFilterApi;
	selection: StoryFilterSelection | undefined;
	run: FilterTestRun | undefined;
	canTest: boolean;
	onSelectionChange: (selection: StoryFilterSelection) => void;
	onTest: () => void;
}

function FilterTestSection({
	filter,
	usage,
	filterApi,
	selection,
	run,
	canTest,
	onSelectionChange,
	onTest,
}: FilterTestSectionProps) {
	const isActive = isFilterSelectionActive(filter.filterType, selection);
	const renderedClause = isActive ? safeRenderClause(usage.clause, filter, selection) : null;

	return (
		<div className='flex flex-col gap-3 rounded-md bg-muted/30 p-2.5'>
			<StoryFilterControl
				filter={{ ...filter, label: 'Test value' }}
				selection={selection}
				onChange={onSelectionChange}
				onOptionError={noop}
				api={filterApi}
			/>
			<FieldSection label='Renders as'>
				<code
					className={cn(
						'rounded-md border bg-background px-2.5 py-1.5 font-mono text-xs break-all',
						!renderedClause && 'text-muted-foreground italic',
					)}
				>
					{renderedClause ?? 'Block removed: the query runs unfiltered'}
				</code>
			</FieldSection>
			<div className='flex items-center gap-2'>
				<Button
					type='button'
					size='sm'
					variant='outline'
					className='h-7 gap-1.5 bg-background text-xs'
					disabled={!canTest || !isActive || run?.status === 'running'}
					onClick={onTest}
				>
					{run?.status === 'running' ? (
						<Loader2 className='size-3.5 animate-spin' />
					) : (
						<FlaskConical className='size-3.5' />
					)}
					Test this filter
				</Button>
				{!isActive && <span className='text-[11px] text-muted-foreground'>Pick a test value first</span>}
			</div>
			{run?.status === 'done' && <TestResultPreview result={run.result} />}
		</div>
	);
}

interface FullQueryTestFooterProps {
	filters: ParsedFilterBlock[];
	testSelections: StoryFilterSelections;
	run: FilterTestRun | undefined;
	onRun: () => void;
	onReset: () => void;
}

function FullQueryTestFooter({ filters, testSelections, run, onRun, onReset }: FullQueryTestFooterProps) {
	const activeFilters = filters.filter((filter) =>
		isFilterSelectionActive(filter.filterType, testSelections[filter.id]),
	);

	return (
		<div className='flex max-h-[45%] shrink-0 flex-col gap-2 border-t bg-panel/40 px-3 py-3'>
			<div className='flex items-center justify-between gap-2'>
				<div className='min-w-0'>
					<div className='text-xs font-semibold text-foreground'>Full query</div>
					<div className='truncate text-[11px] text-muted-foreground'>
						{activeFilters.length > 0
							? `With ${activeFilters.map((filter) => filter.label).join(', ')}`
							: 'No test values: every filter block is removed'}
					</div>
				</div>
				<div className='flex shrink-0 items-center gap-1.5'>
					<Button
						type='button'
						size='icon-sm'
						variant='ghost-muted'
						onClick={onReset}
						title='Reset test values'
						aria-label='Reset test values'
					>
						<RotateCcw className='size-3.5' />
					</Button>
					<Button
						type='button'
						size='sm'
						className='h-8 gap-1.5'
						onClick={onRun}
						disabled={run?.status === 'running'}
					>
						{run?.status === 'running' ? (
							<Loader2 className='size-3.5 animate-spin' />
						) : (
							<Play className='size-3.5' />
						)}
						Run with test values
					</Button>
				</div>
			</div>
			{run?.status === 'done' && (
				<div className='min-h-0 overflow-y-auto'>
					<TestResultPreview result={run.result} />
				</div>
			)}
		</div>
	);
}

function TestResultPreview({ result }: { result: FilterTestResult }) {
	if (result.error) {
		return (
			<div className='flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive'>
				<XCircle className='mt-px size-3.5 shrink-0' />
				<span className='min-w-0'>{result.error}</span>
			</div>
		);
	}

	const columns = Object.keys(result.rows[0] ?? {});
	const share = result.baselineRowCount > 0 ? result.rows.length / result.baselineRowCount : 0;

	return (
		<div className='flex flex-col gap-2'>
			<div className='flex flex-col gap-1'>
				<div className='flex items-baseline justify-between text-xs'>
					<span className='font-medium text-foreground'>
						{result.rows.length} of {formatCount(result.baselineRowCount, 'row')}
					</span>
					<span className='text-muted-foreground'>{Math.round(share * 100)}%</span>
				</div>
				<div className='h-1 overflow-hidden rounded-full bg-muted'>
					<div className='h-full rounded-full bg-primary' style={{ width: `${share * 100}%` }} />
				</div>
			</div>
			{result.unsimulatedFilterIds.length > 0 && (
				<p className='text-[11px] text-amber-600 dark:text-amber-500'>
					{result.unsimulatedFilterIds.join(', ')} filter on columns missing from the result, so their effect
					is not previewed.
				</p>
			)}
			{result.rows.length === 0 ? (
				<div className='rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground'>
					No rows match these test values.
				</div>
			) : (
				<div className='overflow-x-auto rounded-md border bg-background'>
					<table className='w-full text-[11px]'>
						<thead className='bg-muted/50 text-muted-foreground'>
							<tr>
								{columns.map((column) => (
									<th key={column} className='px-2 py-1 text-left font-medium whitespace-nowrap'>
										{column}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{result.rows.slice(0, PREVIEW_ROW_LIMIT).map((row, rowIndex) => (
								<tr key={rowIndex} className='border-t'>
									{columns.map((column) => (
										<td key={column} className='px-2 py-1 whitespace-nowrap text-foreground'>
											{formatCell(row[column])}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
					{result.rows.length > PREVIEW_ROW_LIMIT && (
						<div className='border-t px-2 py-1 text-[11px] text-muted-foreground'>
							and {formatCount(result.rows.length - PREVIEW_ROW_LIMIT, 'more row')}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function CompiledSqlTab({
	sql,
	filters,
	testSelections,
}: {
	sql: string;
	filters: ParsedFilterBlock[];
	testSelections: StoryFilterSelections;
}) {
	const compiled = useMemo(() => compileSql(sql, filters, testSelections), [sql, filters, testSelections]);

	return (
		<div className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3'>
			<p className='px-1 text-xs text-muted-foreground'>
				The SQL sent to the warehouse with the current test values. Blocks of filters without a value are
				removed.
			</p>
			<div className='flex flex-wrap gap-1.5'>
				{filters.map((filter) => {
					const isActive = isFilterSelectionActive(filter.filterType, testSelections[filter.id]);
					return (
						<Badge key={filter.id} variant={isActive ? 'admin' : 'viewer'}>
							{filter.label}:{' '}
							{isActive ? formatSelection(filter.filterType, testSelections[filter.id]) : 'removed'}
						</Badge>
					);
				})}
			</div>
			{compiled.error ? (
				<div className='flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive'>
					<XCircle className='mt-px size-3.5 shrink-0' />
					<span className='min-w-0'>{compiled.error}</span>
				</div>
			) : (
				<pre className='rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground'>
					{compiled.sql}
				</pre>
			)}
		</div>
	);
}

function FieldSection({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className='flex flex-col gap-1.5'>
			<span className='text-[11px] font-medium tracking-wide text-muted-foreground uppercase'>{label}</span>
			{children}
		</div>
	);
}

function IssueList({ issues }: { issues: FilterLintIssue[] }) {
	return (
		<ul className='flex flex-col gap-1.5'>
			{issues.map((issue) => (
				<li
					key={issue.message}
					className={cn(
						'flex items-start gap-1.5 text-xs',
						issue.severity === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400',
					)}
				>
					{issue.severity === 'error' ? (
						<XCircle className='mt-px size-3.5 shrink-0' />
					) : (
						<AlertTriangle className='mt-px size-3.5 shrink-0' />
					)}
					<span className='min-w-0'>{issue.message}</span>
				</li>
			))}
		</ul>
	);
}

function getFilterStatus(usages: FilterBlockUsage[], issues: FilterLintIssue[]): FilterStatus {
	if (issues.some((issue) => issue.severity === 'error')) {
		return 'error';
	}
	if (issues.length > 0) {
		return 'warning';
	}
	return usages.length > 0 ? 'ok' : 'unused';
}

function describeFilterSource(filter: ParsedFilterBlock): string {
	if (filter.options?.length) {
		return formatCount(filter.options.length, 'option');
	}
	if (filter.table && filter.column) {
		return `${filter.table}.${filter.column}`;
	}
	return filter.column ?? 'free text';
}

function compileSql(sql: string, filters: ParsedFilterBlock[], selections: StoryFilterSelections) {
	try {
		return { sql: renderSqlTemplate(sql, selections, buildFilterTypes(filters)).trim(), error: null };
	} catch (error) {
		return { sql: null, error: error instanceof Error ? error.message : 'The SQL template could not be rendered.' };
	}
}

function safeRenderClause(clause: string, filter: ParsedFilterBlock, selection: StoryFilterSelection | undefined) {
	try {
		return renderFilterClause(clause, filter, selection);
	} catch {
		return null;
	}
}

function formatSelection(type: StoryFilterType, selection: StoryFilterSelection | undefined): string {
	if (Array.isArray(selection)) {
		return selection.filter(Boolean).join(type === 'date_range' ? ' → ' : ', ');
	}
	return selection ?? '';
}

function formatCell(value: unknown): string {
	if (typeof value === 'number') {
		return value.toLocaleString();
	}
	return value === null || value === undefined ? '' : String(value);
}

function formatCount(count: number, noun: string): string {
	return `${count} ${pluralize(noun, count)}`;
}
