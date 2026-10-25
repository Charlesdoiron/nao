import { ChevronRight, History } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { StoryRefreshQueryOutcome, StoryRefreshRun } from '@/lib/story-refresh-history';
import { StoryRefreshRunDetail } from '@/components/story-refresh-run-detail';
import { RefreshStatusBadge, RefreshTriggerLabel, STATUS_BAR_CLASSES } from '@/components/story-refresh-status';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
	countSucceededQueries,
	formatRefreshDate,
	formatRefreshDuration,
	REFRESH_STATUS_LABELS,
} from '@/lib/story-refresh-history';
import { cn } from '@/lib/utils';

type RunFilter = 'all' | 'failures';

interface StoryRefreshHistoryProps {
	runs: StoryRefreshRun[];
	selectedRunId?: string;
	selectedQueryId?: string;
	scheduleDescription?: string | null;
	isRefreshing: boolean;
	onSelectRun: (runId: string) => void;
	onViewQueryOnStory: (queryId: string) => void;
	onFixQuery: (run: StoryRefreshRun, query: StoryRefreshQueryOutcome) => void;
	onRefresh: () => void;
}

export function StoryRefreshHistory({
	runs,
	selectedRunId,
	selectedQueryId,
	scheduleDescription,
	isRefreshing,
	onSelectRun,
	onViewQueryOnStory,
	onFixQuery,
	onRefresh,
}: StoryRefreshHistoryProps) {
	const [filter, setFilter] = useState<RunFilter>('all');
	const visibleRuns = useMemo(
		() => (filter === 'all' ? runs : runs.filter((run) => run.status !== 'success')),
		[filter, runs],
	);
	const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0];

	if (!selectedRun) {
		return <EmptyRefreshHistory />;
	}

	return (
		<div className='flex flex-1 min-h-0 flex-col bg-background'>
			<RefreshHistorySummary runs={runs} scheduleDescription={scheduleDescription} />
			<div className='flex flex-1 min-h-0'>
				<section className='flex min-w-0 flex-1 flex-col border-r'>
					<div className='flex items-center gap-2 border-b px-4 py-2 md:px-6'>
						<h2 className='text-sm font-medium'>Runs</h2>
						<span className='text-xs text-muted-foreground'>{visibleRuns.length}</span>
						<RunFilterToggle filter={filter} onFilterChange={setFilter} />
					</div>
					<div className='flex-1 overflow-auto'>
						<RefreshRunsTable runs={visibleRuns} selectedRunId={selectedRun.id} onSelectRun={onSelectRun} />
					</div>
				</section>
				<aside className='w-[44%] min-w-[400px] max-w-[620px] shrink-0 overflow-auto'>
					<StoryRefreshRunDetail
						key={selectedRun.id}
						run={selectedRun}
						selectedQueryId={selectedQueryId}
						isRefreshing={isRefreshing}
						onViewQueryOnStory={onViewQueryOnStory}
						onFixQuery={onFixQuery}
						onRefresh={onRefresh}
					/>
				</aside>
			</div>
		</div>
	);
}

function RefreshHistorySummary({
	runs,
	scheduleDescription,
}: {
	runs: StoryRefreshRun[];
	scheduleDescription?: string | null;
}) {
	const latestRun = runs[0];
	const successfulRuns = runs.filter((run) => run.status === 'success').length;
	const successRate = Math.round((successfulRuns / runs.length) * 100);
	const averageDuration = runs.reduce((total, run) => total + run.durationMs, 0) / runs.length;
	const failedQueries = latestRun.queries.length - countSucceededQueries(latestRun);

	return (
		<div className='grid shrink-0 grid-cols-4 divide-x border-b'>
			<SummaryTile label='Last refresh'>
				<RefreshStatusBadge status={latestRun.status} className='-ml-0.5' />
				<SummaryDetail>
					{formatRefreshDate(latestRun.startedAt)}
					{failedQueries > 0 && ` · ${failedQueries} of ${latestRun.queries.length} queries failed`}
				</SummaryDetail>
			</SummaryTile>
			<SummaryTile label='Success rate'>
				<div className='flex items-end gap-3'>
					<span className='text-xl font-semibold tabular-nums leading-none'>{successRate}%</span>
					<RunStatusStrip runs={runs} />
				</div>
				<SummaryDetail>
					{successfulRuns} of {runs.length} runs fully succeeded
				</SummaryDetail>
			</SummaryTile>
			<SummaryTile label='Average duration'>
				<span className='text-xl font-semibold tabular-nums leading-none'>
					{formatRefreshDuration(Math.round(averageDuration))}
				</span>
				<SummaryDetail>Across the last {runs.length} runs</SummaryDetail>
			</SummaryTile>
			<SummaryTile label='Schedule'>
				<span className='truncate text-sm font-medium'>{scheduleDescription ?? 'No schedule'}</span>
				<SummaryDetail>Manual and chat refreshes are logged too</SummaryDetail>
			</SummaryTile>
		</div>
	);
}

function SummaryTile({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className='flex min-w-0 flex-col gap-1.5 px-4 py-3 md:px-6'>
			<span className='text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>{label}</span>
			{children}
		</div>
	);
}

function SummaryDetail({ children }: { children: React.ReactNode }) {
	return <span className='truncate text-xs text-muted-foreground'>{children}</span>;
}

function RunStatusStrip({ runs }: { runs: StoryRefreshRun[] }) {
	const oldestFirst = [...runs].reverse();
	return (
		<div className='flex h-5 items-end gap-0.5' aria-label='Recent run outcomes, oldest first'>
			{oldestFirst.map((run) => (
				<Tooltip key={run.id}>
					<TooltipTrigger asChild>
						<span
							className={cn(
								'w-1.5 rounded-sm',
								STATUS_BAR_CLASSES[run.status],
								run.status === 'success' ? 'h-3' : 'h-5',
							)}
						/>
					</TooltipTrigger>
					<TooltipContent>
						{REFRESH_STATUS_LABELS[run.status]} · {formatRefreshDate(run.startedAt)}
					</TooltipContent>
				</Tooltip>
			))}
		</div>
	);
}

function RunFilterToggle({
	filter,
	onFilterChange,
}: {
	filter: RunFilter;
	onFilterChange: (filter: RunFilter) => void;
}) {
	const options: { id: RunFilter; label: string }[] = [
		{ id: 'all', label: 'All runs' },
		{ id: 'failures', label: 'Failures only' },
	];
	return (
		<div className='ml-auto flex items-center gap-0.5 rounded-full border p-0.5'>
			{options.map((option) => (
				<button
					key={option.id}
					type='button'
					onClick={() => onFilterChange(option.id)}
					className={cn(
						'cursor-pointer rounded-full px-2.5 py-0.5 text-xs transition-colors',
						filter === option.id
							? 'bg-accent font-medium text-foreground'
							: 'text-muted-foreground hover:text-foreground',
					)}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}

function RefreshRunsTable({
	runs,
	selectedRunId,
	onSelectRun,
}: {
	runs: StoryRefreshRun[];
	selectedRunId: string;
	onSelectRun: (runId: string) => void;
}) {
	return (
		<Table className='text-xs'>
			<TableHeader className='sticky top-0 z-10 bg-background'>
				<TableRow className='hover:bg-transparent'>
					<TableHead className='h-8 pl-4 text-xs text-muted-foreground md:pl-6'>Status</TableHead>
					<TableHead className='h-8 text-xs text-muted-foreground'>Started</TableHead>
					<TableHead className='h-8 text-xs text-muted-foreground'>Trigger</TableHead>
					<TableHead className='h-8 text-xs text-muted-foreground'>Duration</TableHead>
					<TableHead className='h-8 text-xs text-muted-foreground'>Queries</TableHead>
					<TableHead className='h-8 w-8' />
				</TableRow>
			</TableHeader>
			<TableBody>
				{runs.map((run) => (
					<RefreshRunRow
						key={run.id}
						run={run}
						isSelected={run.id === selectedRunId}
						onSelect={() => onSelectRun(run.id)}
					/>
				))}
			</TableBody>
		</Table>
	);
}

function RefreshRunRow({
	run,
	isSelected,
	onSelect,
}: {
	run: StoryRefreshRun;
	isSelected: boolean;
	onSelect: () => void;
}) {
	const succeeded = countSucceededQueries(run);
	return (
		<TableRow
			data-run-status={run.status}
			data-state={isSelected ? 'selected' : undefined}
			aria-selected={isSelected}
			onClick={onSelect}
			className='cursor-pointer'
		>
			<TableCell className='py-1.5 pl-4 md:pl-6'>
				<RefreshStatusBadge status={run.status} />
			</TableCell>
			<TableCell className='py-1.5 tabular-nums' title={run.startedAt.toLocaleString()}>
				{formatRefreshDate(run.startedAt)}
			</TableCell>
			<TableCell className='py-1.5'>
				<RefreshTriggerLabel trigger={run.trigger} />
			</TableCell>
			<TableCell className='py-1.5 tabular-nums text-muted-foreground'>
				{formatRefreshDuration(run.durationMs)}
			</TableCell>
			<TableCell className='py-1.5'>
				<QueryOutcomeMeter succeeded={succeeded} total={run.queries.length} />
			</TableCell>
			<TableCell className='py-1.5 pr-3'>
				<ChevronRight
					className={cn('size-3.5 text-muted-foreground', isSelected ? 'opacity-100' : 'opacity-0')}
				/>
			</TableCell>
		</TableRow>
	);
}

function QueryOutcomeMeter({ succeeded, total }: { succeeded: number; total: number }) {
	return (
		<span className='flex items-center gap-2'>
			<span className='flex h-1.5 w-14 overflow-hidden rounded-full bg-destructive/70'>
				<span className='h-full bg-green-500/70' style={{ width: `${(succeeded / total) * 100}%` }} />
			</span>
			<span className={cn('tabular-nums', succeeded < total && 'font-medium text-foreground')}>
				{succeeded}/{total}
			</span>
		</span>
	);
}

function EmptyRefreshHistory() {
	return (
		<div className='flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground'>
			<History className='size-5' />
			<span>
				No refreshes yet. Runs appear here once the story refreshes on its schedule, manually, or from chat.
			</span>
		</div>
	);
}
