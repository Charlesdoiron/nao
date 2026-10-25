import {
	CalendarClock,
	ChevronDown,
	CircleAlert,
	CircleCheck,
	CircleX,
	Code,
	Crosshair,
	History,
	MessageSquare,
	MousePointerClick,
	Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';

import type {
	StoryRefreshQueryResult,
	StoryRefreshRun,
	StoryRefreshRunStatus,
	StoryRefreshTrigger,
} from '@/lib/story-refresh-history';
import { StoryChartQueryView } from '@/components/side-panel/story-chart-query';
import { Button } from '@/components/ui/button';
import { useStoryQuerySql } from '@/contexts/story-query-sql';
import { useStoryRefreshHistory } from '@/contexts/story-refresh-history';
import { useTimeAgo } from '@/hooks/use-time-ago';
import {
	REFRESH_TRIGGER_LABELS,
	countRefreshedQueries,
	formatRefreshDate,
	formatRefreshDuration,
	getFailedQueries,
	scrollToStoryBlock,
} from '@/lib/story-refresh-history';
import { getTimeAgo } from '@/lib/time-ago';
import { cn } from '@/lib/utils';

export function StoryRefreshTimeline() {
	const history = useStoryRefreshHistory();
	if (!history?.latestRun) {
		return null;
	}

	const { runs, latestRun, selectedRun, isExpanded, setIsExpanded, timelineRef } = history;

	return (
		<div
			ref={timelineRef}
			className={cn(
				'not-prose scroll-mt-4 overflow-hidden rounded-xl border bg-background text-foreground',
				STATUS_STYLES[latestRun.status].border,
			)}
		>
			<LatestRefreshSummary run={latestRun} isExpanded={isExpanded} onToggle={() => setIsExpanded(!isExpanded)} />
			{isExpanded && (
				<ol className='flex flex-col border-t px-2 py-2'>
					{runs.map((run, index) => (
						<TimelineRun
							key={run.id}
							run={run}
							isLast={index === runs.length - 1}
							isSelected={selectedRun?.id === run.id}
						/>
					))}
				</ol>
			)}
		</div>
	);
}

function LatestRefreshSummary({
	run,
	isExpanded,
	onToggle,
}: {
	run: StoryRefreshRun;
	isExpanded: boolean;
	onToggle: () => void;
}) {
	const timeAgo = useTimeAgo(run.startedAt.getTime());
	const style = STATUS_STYLES[run.status];
	const StatusIcon = style.icon;
	const failedCount = getFailedQueries(run).length;

	return (
		<div className={cn('flex items-center gap-3 px-4 py-2.5', style.surface)}>
			<StatusIcon className={cn('size-4 shrink-0', style.text)} strokeWidth={2.25} />
			<div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs'>
				<span className={cn('font-medium', style.text)}>{SUMMARY_TITLES[run.status]}</span>
				<SummaryDot />
				<span className='text-muted-foreground'>
					{countRefreshedQueries(run)} of {run.queries.length} queries refreshed
					{failedCount > 0 && `, ${failedCount} kept their last data`}
				</span>
				<SummaryDot />
				<TriggerLabel trigger={run.trigger} />
				<SummaryDot />
				<span className='text-muted-foreground' title={run.startedAt.toLocaleString()}>
					{timeAgo.humanReadable.toLowerCase()}
				</span>
				<SummaryDot />
				<span className='text-muted-foreground tabular-nums'>{formatRefreshDuration(run.durationMs)}</span>
			</div>
			<Button
				variant='ghost'
				size='sm'
				className='shrink-0 gap-1.5 rounded-full text-xs'
				onClick={onToggle}
				aria-expanded={isExpanded}
			>
				<History className='size-3.5' strokeWidth={2.25} />
				<span>Refresh history</span>
				<ChevronDown
					className={cn('size-3.5 transition-transform duration-200', isExpanded && 'rotate-180')}
					strokeWidth={2.25}
				/>
			</Button>
		</div>
	);
}

function TimelineRun({ run, isLast, isSelected }: { run: StoryRefreshRun; isLast: boolean; isSelected: boolean }) {
	const history = useStoryRefreshHistory();
	const style = STATUS_STYLES[run.status];
	const failedCount = getFailedQueries(run).length;

	return (
		<li className='relative flex gap-3'>
			<div className='relative flex w-5 shrink-0 justify-center pt-3.5'>
				<span className={cn('z-10 size-2.5 rounded-full ring-4 ring-background', style.dot)} />
				{!isLast && <span className='absolute top-6 bottom-0 w-px bg-border' />}
			</div>
			<div className='min-w-0 flex-1 pb-1'>
				<button
					type='button'
					data-run-id={run.id}
					onClick={() => history?.selectRun(isSelected ? null : run.id)}
					className={cn(
						'flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-accent/60',
						isSelected && 'bg-accent hover:bg-accent',
					)}
				>
					<span className='min-w-36 font-medium text-foreground'>{formatRunDate(run.startedAt)}</span>
					<TriggerLabel trigger={run.trigger} triggeredBy={run.triggeredBy} />
					<span className={cn('rounded-full px-2 py-0.5 font-medium', style.badge)}>
						{STATUS_LABELS[run.status]}
					</span>
					<span className='ml-auto flex items-center gap-3 text-muted-foreground tabular-nums'>
						<span>
							{countRefreshedQueries(run)}/{run.queries.length} queries
						</span>
						<span className='w-12 text-right'>{formatRefreshDuration(run.durationMs)}</span>
					</span>
				</button>
				{isSelected && (
					<div className='flex flex-col gap-1.5 px-2.5 pt-2 pb-3'>
						{failedCount > 0 && (
							<p className='flex items-center gap-1.5 text-xs text-muted-foreground'>
								<Crosshair className='size-3' strokeWidth={2.25} />
								{failedCount === 1 ? '1 chart is' : `${failedCount} charts are`} highlighted below
							</p>
						)}
						{run.queries.map((query) => (
							<RunQueryRow key={query.queryId} run={run} query={query} />
						))}
					</div>
				)}
			</div>
		</li>
	);
}

function RunQueryRow({ run, query }: { run: StoryRefreshRun; query: StoryRefreshQueryResult }) {
	const history = useStoryRefreshHistory();
	const querySqlSource = useStoryQuerySql();
	const isFailed = query.status === 'failed';
	const [showSql, setShowSql] = useState(isFailed);
	const isLatestRun = history?.latestRun?.id === run.id;

	return (
		<div
			className={cn(
				'flex flex-col gap-2 rounded-lg border px-3 py-2',
				isFailed ? 'border-destructive/30 bg-destructive/5' : 'bg-background',
			)}
		>
			<div className='flex items-center gap-2 text-xs'>
				{isFailed ? (
					<CircleX className='size-3.5 shrink-0 text-destructive' strokeWidth={2.25} />
				) : (
					<CircleCheck className='size-3.5 shrink-0 text-green-600 dark:text-green-500' strokeWidth={2.25} />
				)}
				<span className='truncate font-medium'>{query.title}</span>
				<code className='truncate font-mono text-[11px] text-muted-foreground'>{query.queryId}</code>
				<span className='ml-auto flex shrink-0 items-center gap-3 text-muted-foreground tabular-nums'>
					{query.rowCount !== undefined && <span>{query.rowCount} rows</span>}
					<span>{formatRefreshDuration(query.durationMs)}</span>
				</span>
				<Button
					variant='ghost-muted'
					size='icon-xs'
					title={showSql ? 'Hide SQL' : 'Show SQL that ran'}
					onClick={() => setShowSql((current) => !current)}
					className={cn('shrink-0 hover:rounded-full', showSql && 'bg-accent rounded-full')}
				>
					<Code className='size-3.5' />
				</Button>
			</div>
			{isFailed && query.errorMessage && (
				<p className='rounded-md bg-destructive/10 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed break-words text-destructive'>
					{query.errorMessage}
				</p>
			)}
			{showSql && querySqlSource && <StoryChartQueryView queryId={query.queryId} source={querySqlSource} />}
			{isFailed && (
				<div className='flex items-center justify-end gap-2'>
					<Button
						variant='ghost'
						size='sm'
						className='gap-1.5 rounded-full text-xs'
						onClick={() => scrollToStoryBlock(query.queryId)}
					>
						<Crosshair className='size-3.5' strokeWidth={2.25} />
						Show chart
					</Button>
					{isLatestRun && (
						<Button
							variant='outline'
							size='sm'
							className='gap-1.5 rounded-full text-xs'
							onClick={() => history?.fixWithNao(run, query)}
						>
							<Sparkles className='size-3.5' strokeWidth={2.25} />
							Fix with nao
						</Button>
					)}
				</div>
			)}
		</div>
	);
}

function TriggerLabel({ trigger, triggeredBy }: { trigger: StoryRefreshTrigger; triggeredBy?: string }) {
	const Icon = TRIGGER_ICONS[trigger];
	return (
		<span className='inline-flex items-center gap-1 text-muted-foreground'>
			<Icon className='size-3' strokeWidth={2.25} />
			{REFRESH_TRIGGER_LABELS[trigger]}
			{triggeredBy && <span className='opacity-70'>by {triggeredBy}</span>}
		</span>
	);
}

function SummaryDot() {
	return <span className='text-muted-foreground/50'>·</span>;
}

function formatRunDate(date: Date) {
	return `${formatRefreshDate(date)} · ${getTimeAgo(date.getTime()).humanReadable.toLowerCase()}`;
}

const TRIGGER_ICONS: Record<StoryRefreshTrigger, LucideIcon> = {
	schedule: CalendarClock,
	manual: MousePointerClick,
	chat: MessageSquare,
};

const STATUS_LABELS: Record<StoryRefreshRunStatus, string> = {
	success: 'Succeeded',
	partial: 'Partial',
	failed: 'Failed',
};

const SUMMARY_TITLES: Record<StoryRefreshRunStatus, string> = {
	success: 'Last refresh succeeded',
	partial: 'Last refresh partially failed',
	failed: 'Last refresh failed',
};

const STATUS_STYLES: Record<
	StoryRefreshRunStatus,
	{ icon: LucideIcon; text: string; dot: string; badge: string; surface: string; border: string }
> = {
	success: {
		icon: CircleCheck,
		text: 'text-green-600 dark:text-green-500',
		dot: 'bg-green-500',
		badge: 'bg-green-500/10 text-green-600 dark:text-green-500',
		surface: 'bg-muted/30',
		border: 'border-border',
	},
	partial: {
		icon: CircleAlert,
		text: 'text-amber-600 dark:text-amber-500',
		dot: 'bg-amber-500',
		badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
		surface: 'bg-amber-500/5',
		border: 'border-amber-500/30',
	},
	failed: {
		icon: CircleX,
		text: 'text-destructive',
		dot: 'bg-destructive',
		badge: 'bg-destructive/10 text-destructive',
		surface: 'bg-destructive/5',
		border: 'border-destructive/30',
	},
};
