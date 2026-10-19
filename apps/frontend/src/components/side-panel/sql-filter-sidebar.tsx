import {
	AlertCircle,
	AlertTriangle,
	CalendarDays,
	CaseSensitive,
	CheckCircle2,
	Crosshair,
	Filter,
	Hash,
	ListChecks,
	ListFilter,
	Plus,
	Search,
	ToggleLeft,
	Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StoryFilterSelection, StoryFilterSelections, StoryFilterType } from '@nao/shared/sql-template';
import type { ParsedFilterBlock } from '@nao/shared/story-segments';

import type {
	SqlField,
	SqlFieldType,
	SqlFilterClause,
	SqlFilterLintField,
	SqlFilterLintIssue,
	SqlFilterOperator,
} from '@/lib/sql-filter-clauses';
import { StoryFilterControl } from '@/components/story-filter-bar';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { buildFilterBlock, OPERATORS_BY_FILTER_TYPE } from '@/lib/sql-filter-clauses';
import { cn } from '@/lib/utils';

const FILTER_TYPE_ICONS: Record<StoryFilterType, LucideIcon> = {
	select: ListFilter,
	multi_select: ListChecks,
	search: Search,
	date_range: CalendarDays,
};

const FILTER_TYPE_LABELS: Record<StoryFilterType, string> = {
	select: 'Single select',
	multi_select: 'Multi select',
	search: 'Search',
	date_range: 'Date range',
};

const FIELD_TYPE_ICONS: Record<SqlFieldType, LucideIcon> = {
	text: CaseSensitive,
	number: Hash,
	date: CalendarDays,
	boolean: ToggleLeft,
};

const OPERATOR_LABELS: Record<SqlFilterOperator, string> = {
	'=': 'equals',
	'!=': 'does not equal',
	IN: 'is one of',
	'NOT IN': 'is not one of',
	ILIKE: 'contains (case-insensitive)',
	LIKE: 'contains',
	BETWEEN: 'is between',
};

interface SqlFilterSidebarProps {
	clauses: SqlFilterClause[];
	storyFilters: ParsedFilterBlock[];
	fields: SqlField[];
	sourceTable?: string;
	issues: SqlFilterLintIssue[];
	testValues: StoryFilterSelections;
	activeClauseKey: string | null;
	onClauseChange: (clauseKey: string, patch: Partial<Omit<SqlFilterClause, 'key' | 'filterId'>>) => void;
	onFilterIdChange: (clauseKey: string, filterId: string) => void;
	onTestValueChange: (filterId: string, selection: StoryFilterSelection) => void;
	onAddClause: (filterId: string) => void;
	onRemoveClause: (clauseKey: string) => void;
	onPlaceClause: (clauseKey: string) => void;
	onLocateClause: (clauseKey: string) => void;
}

/** Right-hand sidebar of the SQL editor: one structured card per story filter condition used by the query. */
export function SqlFilterSidebar({
	clauses,
	storyFilters,
	fields,
	sourceTable,
	issues,
	testValues,
	activeClauseKey,
	onClauseChange,
	onFilterIdChange,
	onTestValueChange,
	onAddClause,
	onRemoveClause,
	onPlaceClause,
	onLocateClause,
}: SqlFilterSidebarProps) {
	const usedFilterIds = new Set(clauses.map((clause) => clause.filterId));
	const unusedFilters = storyFilters.filter((filter) => !usedFilterIds.has(filter.id));
	const globalIssues = issues.filter((issue) => issue.clauseKey === null);

	return (
		<aside className='flex h-full min-h-0 flex-col bg-panel/40'>
			<SidebarHeader clauseCount={clauses.length} issues={issues} />
			<div className='min-h-0 flex-1 overflow-y-auto px-3 py-3'>
				<div className='flex flex-col gap-3'>
					{globalIssues.map((issue) => (
						<IssueMessage key={issue.message} issue={issue} className='rounded-lg border px-3 py-2' />
					))}
					{clauses.map((clause) => (
						<FilterClauseCard
							key={clause.key}
							clause={clause}
							storyFilters={storyFilters}
							fields={fields}
							sourceTable={sourceTable}
							issues={issues.filter((issue) => issue.clauseKey === clause.key)}
							testValue={testValues[clause.filterId]}
							isActive={activeClauseKey === clause.key}
							onChange={(patch) => onClauseChange(clause.key, patch)}
							onFilterIdChange={(filterId) => onFilterIdChange(clause.key, filterId)}
							onTestValueChange={(selection) => onTestValueChange(clause.filterId, selection)}
							onRemove={() => onRemoveClause(clause.key)}
							onPlace={() => onPlaceClause(clause.key)}
							onLocate={() => onLocateClause(clause.key)}
						/>
					))}
					{clauses.length === 0 && (
						<div className='rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground'>
							This query does not react to any story filter yet.
						</div>
					)}
				</div>
			</div>
			<SidebarFooter storyFilters={storyFilters} unusedFilters={unusedFilters} onAddClause={onAddClause} />
		</aside>
	);
}

function SidebarHeader({ clauseCount, issues }: { clauseCount: number; issues: SqlFilterLintIssue[] }) {
	const errorCount = issues.filter((issue) => issue.severity === 'error').length;
	const warningCount = issues.length - errorCount;

	return (
		<div className='flex h-12 shrink-0 items-center gap-2 border-b px-4'>
			<Filter className='size-3.5 text-muted-foreground' />
			<span className='text-sm font-semibold text-foreground'>Filters</span>
			<span className='text-xs text-muted-foreground'>{clauseCount}</span>
			<div className='ml-auto'>
				{errorCount > 0 ? (
					<span className='inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive'>
						<AlertCircle className='size-3' />
						{errorCount} {errorCount === 1 ? 'issue' : 'issues'}
					</span>
				) : warningCount > 0 ? (
					<span className='inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400'>
						<AlertTriangle className='size-3' />
						{warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
					</span>
				) : (
					<span className='inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-500'>
						<CheckCircle2 className='size-3' />
						Valid
					</span>
				)}
			</div>
		</div>
	);
}

interface FilterClauseCardProps {
	clause: SqlFilterClause;
	storyFilters: ParsedFilterBlock[];
	fields: SqlField[];
	sourceTable?: string;
	issues: SqlFilterLintIssue[];
	testValue: StoryFilterSelection | undefined;
	isActive: boolean;
	onChange: (patch: Partial<Omit<SqlFilterClause, 'key' | 'filterId'>>) => void;
	onFilterIdChange: (filterId: string) => void;
	onTestValueChange: (selection: StoryFilterSelection) => void;
	onRemove: () => void;
	onPlace: () => void;
	onLocate: () => void;
}

function FilterClauseCard({
	clause,
	storyFilters,
	fields,
	sourceTable,
	issues,
	testValue,
	isActive,
	onChange,
	onFilterIdChange,
	onTestValueChange,
	onRemove,
	onPlace,
	onLocate,
}: FilterClauseCardProps) {
	const storyFilter = storyFilters.find((filter) => filter.id === clause.filterId);
	const TypeIcon = storyFilter ? FILTER_TYPE_ICONS[storyFilter.filterType] : AlertCircle;
	const issuesFor = (field: SqlFilterLintField) => issues.filter((issue) => issue.field === field);
	const hasErrors = issues.some((issue) => issue.severity === 'error');
	const placementIssues = issuesFor('placement');
	const isPlaced = !placementIssues.some((issue) => issue.message.startsWith('Not placed'));

	return (
		<section
			className={cn(
				'flex flex-col gap-3 rounded-xl border bg-background p-3 shadow-xs transition-colors',
				hasErrors && 'border-destructive/40',
				isActive && 'ring-2 ring-primary/30',
			)}
		>
			<header className='flex items-center gap-2'>
				<span
					className={cn(
						'flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground',
						!storyFilter && 'bg-destructive/10 text-destructive',
					)}
				>
					<TypeIcon className='size-3.5' />
				</span>
				<div className='flex min-w-0 flex-1 flex-col'>
					<span className='truncate text-sm font-medium text-foreground'>
						{storyFilter?.label ?? clause.filterId}
					</span>
					<span className='truncate text-[11px] text-muted-foreground'>
						{storyFilter ? FILTER_TYPE_LABELS[storyFilter.filterType] : 'Undeclared filter'}
					</span>
				</div>
				<Button
					type='button'
					variant='ghost-muted'
					size='icon-xs'
					onClick={onLocate}
					disabled={!isPlaced}
					aria-label='Show in SQL'
					title='Show in SQL'
				>
					<Crosshair className='size-3.5' />
				</Button>
				<Button
					type='button'
					variant='ghost-muted'
					size='icon-xs'
					onClick={onRemove}
					aria-label='Remove filter condition'
					title='Remove filter condition'
				>
					<Trash2 className='size-3.5' />
				</Button>
			</header>

			<FieldRow label='Variable' issues={issuesFor('filterId')}>
				<VariableSelect
					value={clause.filterId}
					storyFilters={storyFilters}
					invalid={issuesFor('filterId').length > 0}
					onChange={onFilterIdChange}
				/>
			</FieldRow>

			{clause.customCondition !== undefined ? (
				<FieldRow label='Condition' issues={issuesFor('condition')}>
					<Textarea
						value={clause.customCondition}
						onChange={(event) => onChange({ customCondition: event.target.value })}
						aria-invalid={issuesFor('condition').length > 0}
						className='min-h-16 font-mono text-xs'
						spellCheck={false}
					/>
				</FieldRow>
			) : (
				<div className='flex flex-col gap-1'>
					<div className='grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2'>
						<FieldRow label='Field' hint={sourceTable}>
							<FieldSelect
								value={clause.column}
								fields={fields}
								invalid={issuesFor('column').some((issue) => issue.severity === 'error')}
								onChange={(column) => onChange({ column })}
							/>
						</FieldRow>
						<FieldRow label='Operator'>
							<OperatorSelect
								value={clause.operator}
								filterType={storyFilter?.filterType}
								invalid={issuesFor('operator').length > 0}
								onChange={(operator) => onChange({ operator })}
							/>
						</FieldRow>
					</div>
					{[...issuesFor('column'), ...issuesFor('operator')].map((issue) => (
						<IssueMessage key={issue.message} issue={issue} />
					))}
				</div>
			)}

			{placementIssues.length > 0 && (
				<div className='flex items-start gap-2 rounded-lg bg-destructive/5 px-2.5 py-2'>
					<IssueMessage issue={placementIssues[0]} className='flex-1 p-0' />
					{!isPlaced && (
						<Button
							type='button'
							variant='outline'
							size='sm'
							className='h-6 shrink-0 px-2 text-xs'
							onClick={onPlace}
						>
							Place in SQL
						</Button>
					)}
				</div>
			)}

			{storyFilter && (
				<div className='rounded-lg bg-muted/40 p-2.5 [&_[aria-haspopup]]:w-full [&_[data-slot=input]]:w-full [&_[data-slot=select-trigger]]:w-full'>
					<StoryFilterControl
						filter={storyFilter}
						selection={testValue}
						onChange={onTestValueChange}
						onOptionError={noop}
						label='Test value'
					/>
				</div>
			)}

			<JinjaPreview clause={clause} />
		</section>
	);
}

function FieldRow({
	label,
	hint,
	issues,
	children,
}: {
	label: string;
	hint?: string;
	issues?: SqlFilterLintIssue[];
	children: React.ReactNode;
}) {
	return (
		<div className='flex flex-col gap-1'>
			<div className='flex items-baseline justify-between gap-2'>
				<span className='text-xs font-medium text-muted-foreground'>{label}</span>
				{hint && <span className='truncate font-mono text-[11px] text-muted-foreground/80'>{hint}</span>}
			</div>
			{children}
			{issues?.map((issue) => (
				<IssueMessage key={issue.message} issue={issue} />
			))}
		</div>
	);
}

function VariableSelect({
	value,
	storyFilters,
	invalid,
	onChange,
}: {
	value: string;
	storyFilters: ParsedFilterBlock[];
	invalid: boolean;
	onChange: (filterId: string) => void;
}) {
	const isDeclared = storyFilters.some((filter) => filter.id === value);
	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger className='h-8 w-full bg-background font-mono text-xs' aria-invalid={invalid}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{!isDeclared && (
					<SelectItem value={value} className='font-mono text-xs text-destructive'>
						filters.{value}
					</SelectItem>
				)}
				{storyFilters.map((filter) => {
					const Icon = FILTER_TYPE_ICONS[filter.filterType];
					return (
						<SelectItem key={filter.id} value={filter.id} className='font-mono text-xs'>
							<Icon className='size-3.5 text-muted-foreground' />
							filters.{filter.id}
							<span className='font-sans text-muted-foreground'>· {filter.label}</span>
						</SelectItem>
					);
				})}
			</SelectContent>
		</Select>
	);
}

function FieldSelect({
	value,
	fields,
	invalid,
	onChange,
}: {
	value: string;
	fields: SqlField[];
	invalid: boolean;
	onChange: (column: string) => void;
}) {
	const isKnown = fields.some((field) => field.name.toLowerCase() === value.toLowerCase());
	return (
		<Select value={value || undefined} onValueChange={onChange}>
			<SelectTrigger className='h-8 w-full bg-background font-mono text-xs' aria-invalid={invalid}>
				<SelectValue placeholder='Pick a field' />
			</SelectTrigger>
			<SelectContent>
				{value && !isKnown && (
					<SelectItem value={value} className='font-mono text-xs text-destructive'>
						<AlertCircle className='size-3.5' />
						{value}
					</SelectItem>
				)}
				{fields.map((field) => {
					const Icon = FIELD_TYPE_ICONS[field.type];
					return (
						<SelectItem key={field.name} value={field.name} className='font-mono text-xs'>
							<Icon className='size-3.5 text-muted-foreground' />
							{field.name}
						</SelectItem>
					);
				})}
			</SelectContent>
		</Select>
	);
}

function OperatorSelect({
	value,
	filterType,
	invalid,
	onChange,
}: {
	value: SqlFilterOperator;
	filterType: StoryFilterType | undefined;
	invalid: boolean;
	onChange: (operator: SqlFilterOperator) => void;
}) {
	const allowed = filterType ? OPERATORS_BY_FILTER_TYPE[filterType] : [];
	const options = allowed.includes(value) ? allowed : [value, ...allowed];
	return (
		<Select value={value} onValueChange={(next) => onChange(next as SqlFilterOperator)}>
			<SelectTrigger className='h-8 w-full bg-background font-mono text-xs' aria-invalid={invalid}>
				<SelectValue>{value}</SelectValue>
			</SelectTrigger>
			<SelectContent align='end'>
				{options.map((operator) => (
					<SelectItem
						key={operator}
						value={operator}
						className={cn('text-xs', !allowed.includes(operator) && 'text-destructive')}
					>
						<span className='w-14 font-mono'>{operator}</span>
						<span className='text-muted-foreground'>{OPERATOR_LABELS[operator]}</span>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function JinjaPreview({ clause }: { clause: SqlFilterClause }) {
	return (
		<details className='group'>
			<summary className='cursor-pointer list-none text-[11px] font-medium text-muted-foreground select-none hover:text-foreground'>
				<span className='group-open:hidden'>Show Jinja</span>
				<span className='hidden group-open:inline'>Hide Jinja</span>
			</summary>
			<code className='mt-1.5 block rounded-md bg-muted/60 px-2 py-1.5 font-mono text-[11px] leading-relaxed break-all text-muted-foreground'>
				{buildFilterBlock(clause)}
			</code>
		</details>
	);
}

function IssueMessage({ issue, className }: { issue: SqlFilterLintIssue; className?: string }) {
	const Icon = issue.severity === 'error' ? AlertCircle : AlertTriangle;
	return (
		<p
			className={cn(
				'flex items-start gap-1.5 text-xs leading-snug',
				issue.severity === 'error'
					? 'border-destructive/30 text-destructive'
					: 'border-amber-500/30 text-amber-700 dark:text-amber-400',
				className,
			)}
		>
			<Icon className='mt-0.5 size-3 shrink-0' />
			<span>{issue.message}</span>
		</p>
	);
}

function SidebarFooter({
	storyFilters,
	unusedFilters,
	onAddClause,
}: {
	storyFilters: ParsedFilterBlock[];
	unusedFilters: ParsedFilterBlock[];
	onAddClause: (filterId: string) => void;
}) {
	return (
		<div className='flex shrink-0 flex-col gap-2 border-t px-3 py-3'>
			{unusedFilters.length > 0 && (
				<p className='text-[11px] text-muted-foreground'>
					Not used by this query: {unusedFilters.map((filter) => filter.label).join(', ')}
				</p>
			)}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button type='button' variant='outline' size='sm' className='w-full rounded-full text-xs'>
						<Plus className='size-3.5' />
						Add filter condition
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align='center' className='min-w-64'>
					<DropdownMenuLabel className='text-xs text-muted-foreground'>Story filters</DropdownMenuLabel>
					{storyFilters.map((filter) => {
						const Icon = FILTER_TYPE_ICONS[filter.filterType];
						const isUnused = unusedFilters.includes(filter);
						return (
							<DropdownMenuItem key={filter.id} onSelect={() => onAddClause(filter.id)}>
								<Icon className='size-3.5 text-muted-foreground' />
								<span>{filter.label}</span>
								<span className='ml-auto font-mono text-[11px] text-muted-foreground'>
									{isUnused ? `filters.${filter.id}` : 'in use'}
								</span>
							</DropdownMenuItem>
						);
					})}
					<DropdownMenuSeparator />
					<p className='px-2 py-1.5 text-[11px] text-muted-foreground'>
						Declare new filters in the story with a {'<filter />'} tag.
					</p>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

function noop() {}
