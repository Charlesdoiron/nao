import {
	ChartColumn,
	Check,
	ChevronRight,
	CircleCheck,
	CircleX,
	Clock,
	Copy,
	Crosshair,
	History,
	Map as MapIcon,
	MessageSquare,
	MousePointerClick,
	Sparkles,
	Table2,
	TriangleAlert,
	X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

import type { StoryRefreshHistoryValue } from '@/contexts/story-refresh-history';
import type {
	StoryQueryBlockKind,
	StoryRefreshQueryResult,
	StoryRefreshRun,
	StoryRefreshRunStatus,
	StoryRefreshTrigger,
} from '@/lib/story-refresh-history';
import { SqlQueryDisplay } from '@/components/tool-calls/sql-query-display';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { countRunQueries, formatRunDate, formatRunDuration, TRIGGER_LABELS } from '@/lib/story-refresh-history';
import { cn } from '@/lib/utils';

const RUN_STATUS_STYLES: Record<StoryRefreshRunStatus, { icon: LucideIcon; className: string; label: string }> = {
	success: { icon: CircleCheck, className: 'text-green-600 dark:text-green-500', label: 'Succeeded' },
	partial: { icon: TriangleAlert, className: 'text-amber-600 dark:text-amber-500', label: 'Partially failed' },
	failed: { icon: CircleX, className: 'text-destructive', label: 'Failed' },
};

const RUN_STATUS_BAR_CLASSES: Record<StoryRefreshRunStatus, string> = {
	success: 'bg-green-500/70',
	partial: 'bg-amber-500/80',
	failed: 'bg-destructive/80',
};

const TRIGGER_ICONS: Record<StoryRefreshTrigger, LucideIcon> = {
	schedule: Clock,
	manual: MousePointerClick,
	chat: MessageSquare,
};

const BLOCK_KIND_ICONS: Record<StoryQueryBlockKind, LucideIcon> = {
	chart: ChartColumn,
	table: Table2,
	map: MapIcon,
};

export function StoryRefreshHistoryPanel({ history }: { history: StoryRefreshHistoryValue }) {
	const { runs, focus, scheduleDescription, close } = history;
	const [expandedRunId, setExpandedRunId] = useState<string | null>(() => getDefaultExpandedRunId(history));

	useEffect(() => {
		if (focus) {
			setExpandedRunId(focus.runId);
		}
	}, [focus]);

	return (
		<aside className='flex w-[420px] shrink-0 flex-col border-l bg-background' aria-label='Refresh history'>
			<div className='flex shrink-0 items-start justify-between gap-2 border-b px-4 py-3'>
				<div className='min-w-0'>
					<div className='flex items-center gap-2 text-sm font-medium'>
						<History className='size-3.5' strokeWidth={2.25} />
						Refresh history
					</div>
					<div className='mt-0.5 text-xs text-muted-foreground'>
						{scheduleDescription ? `Live story · ${scheduleDescription}` : 'Live story'}
					</div>
				</div>
				<Button
					variant='ghost'
					size='icon-sm'
					className='hover:rounded-full'
					onClick={close}
					aria-label='Close refresh history'
				>
					<X className='size-3.5' />
				</Button>
			</div>

			{runs.length === 0 ? (
				<div className='p-6 text-center text-sm text-muted-foreground'>
					This story has not been refreshed yet.
				</div>
			) : (
				<>
					<RunStatusStrip runs={runs} />
					<div className='flex-1 overflow-y-auto px-2 pb-4'>
						{runs.map((run) => (
							<RunItem
								key={run.id}
								run={run}
								history={history}
								isExpanded={expandedRunId === run.id}
								onToggle={() => setExpandedRunId((current) => (current === run.id ? null : run.id))}
							/>
						))}
					</div>
				</>
			)}
		</aside>
	);
}

function RunStatusStrip({ runs }: { runs: StoryRefreshRun[] }) {
	const counts = countRunsByStatus(runs);
	const chronologicalRuns = [...runs].reverse();

	return (
		<div className='shrink-0 px-4 pt-3 pb-2'>
			<div className='flex h-5 items-end gap-1'>
				{chronologicalRuns.map((run) => (
					<Tooltip key={run.id}>
						<TooltipTrigger asChild>
							<div className={cn('h-full flex-1 rounded-sm', RUN_STATUS_BAR_CLASSES[run.status])} />
						</TooltipTrigger>
						<TooltipContent>
							{formatRunDate(run.startedAt)} · {RUN_STATUS_STYLES[run.status].label}
						</TooltipContent>
					</Tooltip>
				))}
			</div>
			<div className='mt-2 flex items-center justify-between text-xs text-muted-foreground'>
				<span>Last {runs.length} refreshes</span>
				<span>
					{counts.success} succeeded · {counts.partial} partial · {counts.failed} failed
				</span>
			</div>
		</div>
	);
}

function RunItem({
	run,
	history,
	isExpanded,
	onToggle,
}: {
	run: StoryRefreshRun;
	history: StoryRefreshHistoryValue;
	isExpanded: boolean;
	onToggle: () => void;
}) {
	const { icon: StatusIcon, className: statusClassName, label: statusLabel } = RUN_STATUS_STYLES[run.status];
	const TriggerIcon = TRIGGER_ICONS[run.trigger];
	const { refreshed, total } = countRunQueries(run);
	const sharedErrorMessage = getSharedErrorMessage(run);

	return (
		<div className={cn('rounded-lg', isExpanded && 'bg-muted/40')}>
			<button
				type='button'
				onClick={onToggle}
				aria-expanded={isExpanded}
				className='flex w-full cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-accent/60'
			>
				<StatusIcon className={cn('mt-0.5 size-4 shrink-0', statusClassName)} aria-label={statusLabel} />
				<div className='min-w-0 flex-1'>
					<div className='flex items-center gap-2'>
						<span className='truncate text-sm font-medium'>{formatRunDate(run.startedAt)}</span>
						<span className='ml-auto shrink-0 text-xs tabular-nums text-muted-foreground'>
							{formatRunDuration(run.durationMs)}
						</span>
					</div>
					<div className='mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground'>
						<TriggerIcon className='size-3 shrink-0' />
						<span className='truncate'>
							{TRIGGER_LABELS[run.trigger]}
							{run.triggeredBy && ` · ${run.triggeredBy}`}
						</span>
						<span aria-hidden>·</span>
						<span className={cn('shrink-0 tabular-nums', refreshed < total && statusClassName)}>
							{refreshed}/{total} queries refreshed
						</span>
					</div>
				</div>
				<ChevronRight
					className={cn(
						'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform',
						isExpanded && 'rotate-90',
					)}
				/>
			</button>

			{isExpanded && (
				<div className='flex flex-col gap-1.5 px-2 pb-3 pl-9'>
					{sharedErrorMessage && (
						<div className='mb-1 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs'>
							<div className='font-medium text-destructive'>Every query failed with the same error</div>
							<div className='mt-1 font-mono text-[11px] leading-relaxed break-words text-destructive/90'>
								{sharedErrorMessage}
							</div>
							<div className='mt-1.5 text-muted-foreground'>
								This points to the warehouse connection rather than the story's SQL.
							</div>
						</div>
					)}
					{run.queries.map((query) => (
						<QueryResultItem
							key={query.queryId}
							run={run}
							query={query}
							history={history}
							isFocused={history.focus?.runId === run.id && history.focus.queryId === query.queryId}
							isErrorShownOnRun={sharedErrorMessage !== null}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function QueryResultItem({
	run,
	query,
	history,
	isFocused,
	isErrorShownOnRun,
}: {
	run: StoryRefreshRun;
	query: StoryRefreshQueryResult;
	history: StoryRefreshHistoryValue;
	isFocused: boolean;
	isErrorShownOnRun: boolean;
}) {
	const isFailed = query.status === 'failed';
	const [isOpen, setIsOpen] = useState((isFailed && !isErrorShownOnRun) || isFocused);
	const itemRef = useRef<HTMLDivElement>(null);
	const KindIcon = BLOCK_KIND_ICONS[query.blockKind];

	useEffect(() => {
		if (isFocused) {
			setIsOpen(true);
			itemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}, [isFocused]);

	return (
		<div
			ref={itemRef}
			className={cn(
				'rounded-md border bg-background',
				isFailed && 'border-destructive/30',
				isFocused && 'ring-2 ring-destructive/30',
			)}
		>
			<button
				type='button'
				onClick={() => setIsOpen((current) => !current)}
				aria-expanded={isOpen}
				className='flex w-full cursor-pointer items-center gap-2 px-2.5 py-2 text-left'
			>
				{isFailed ? (
					<CircleX className='size-3.5 shrink-0 text-destructive' />
				) : (
					<Check className='size-3.5 shrink-0 text-green-600 dark:text-green-500' />
				)}
				<KindIcon className='size-3.5 shrink-0 text-muted-foreground' />
				<span className='min-w-0 flex-1 truncate text-xs font-medium'>{query.title}</span>
				<span className='shrink-0 text-[11px] tabular-nums text-muted-foreground'>
					{isFailed ? 'Error' : `${query.rowCount ?? 0} rows`} · {formatRunDuration(query.durationMs)}
				</span>
			</button>

			{isOpen && (
				<div className='flex flex-col gap-2 border-t px-2.5 py-2.5'>
					{query.errorMessage && !isErrorShownOnRun && (
						<div className='rounded-md bg-destructive/10 px-2.5 py-2 font-mono text-[11px] leading-relaxed break-words text-destructive'>
							{query.errorMessage}
						</div>
					)}
					<QuerySql queryId={query.queryId} sql={query.sql} />
					<div className='flex flex-wrap items-center gap-1.5'>
						{isFailed && (
							<Button
								variant='primary-gradient'
								size='sm'
								className='gap-1.5 rounded-full text-xs'
								onClick={() => history.fixWithNao(run, query)}
							>
								<Sparkles className='size-3' strokeWidth={2.25} />
								Fix with nao
							</Button>
						)}
						<Button
							variant='outline'
							size='sm'
							className='gap-1.5 rounded-full text-xs'
							onClick={() => history.showInStory(query.queryId)}
						>
							<Crosshair className='size-3' strokeWidth={2.25} />
							Show in story
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

function QuerySql({ queryId, sql }: { queryId: string; sql: string }) {
	const [isCopied, setIsCopied] = useState(false);

	const handleCopy = () => {
		navigator.clipboard.writeText(sql);
		setIsCopied(true);
		window.setTimeout(() => setIsCopied(false), 1_500);
	};

	return (
		<div className='overflow-hidden rounded-md border bg-muted/30'>
			<div className='flex items-center justify-between border-b px-2.5 py-1'>
				<span className='font-mono text-[10px] text-muted-foreground'>{queryId}</span>
				<Button
					variant='ghost-muted'
					size='icon-xs'
					className='size-5 hover:rounded-full'
					onClick={handleCopy}
					aria-label='Copy SQL'
				>
					{isCopied ? <Check className='size-3 text-green-600' /> : <Copy className='size-3' />}
				</Button>
			</div>
			<SqlQueryDisplay query={sql} className='max-h-56 px-2.5 py-1.5 text-[11px]' />
		</div>
	);
}

function getDefaultExpandedRunId({ runs, focus }: StoryRefreshHistoryValue): string | null {
	if (focus) {
		return focus.runId;
	}
	const [latestRun] = runs;
	return latestRun && latestRun.status !== 'success' ? latestRun.id : null;
}

function getSharedErrorMessage(run: StoryRefreshRun): string | null {
	if (run.status !== 'failed' || run.queries.length < 2) {
		return null;
	}
	const messages = new Set(run.queries.map((query) => query.errorMessage));
	const [message] = messages;
	return messages.size === 1 && message ? message : null;
}

function countRunsByStatus(runs: StoryRefreshRun[]): Record<StoryRefreshRunStatus, number> {
	const counts: Record<StoryRefreshRunStatus, number> = { success: 0, partial: 0, failed: 0 };
	for (const run of runs) {
		counts[run.status] += 1;
	}
	return counts;
}
