import { ChartColumn, Code, Map as MapIcon, RefreshCw, Sparkles, SquareArrowOutUpRight, Table2 } from 'lucide-react';
import { useState } from 'react';
import { pluralize } from '@nao/shared';
import type { LucideIcon } from 'lucide-react';

import type { StoryQueryBlockKind, StoryRefreshQueryOutcome, StoryRefreshRun } from '@/lib/story-refresh-history';
import { RefreshStatusBadge, RefreshStatusIcon, RefreshTriggerLabel } from '@/components/story-refresh-status';
import { SqlQueryDisplay } from '@/components/tool-calls/sql-query-display';
import { Button } from '@/components/ui/button';
import {
	countSucceededQueries,
	formatRefreshDate,
	formatRefreshDuration,
	getSharedErrorMessage,
	REFRESH_TRIGGER_LABELS,
} from '@/lib/story-refresh-history';
import { cn } from '@/lib/utils';

const BLOCK_KIND_ICONS: Record<StoryQueryBlockKind, LucideIcon> = {
	chart: ChartColumn,
	table: Table2,
	map: MapIcon,
};

interface StoryRefreshRunDetailProps {
	run: StoryRefreshRun;
	selectedQueryId?: string;
	isRefreshing: boolean;
	onViewQueryOnStory: (queryId: string) => void;
	onFixQuery: (run: StoryRefreshRun, query: StoryRefreshQueryOutcome) => void;
	onRefresh: () => void;
}

export function StoryRefreshRunDetail({
	run,
	selectedQueryId,
	isRefreshing,
	onViewQueryOnStory,
	onFixQuery,
	onRefresh,
}: StoryRefreshRunDetailProps) {
	const sharedErrorMessage = getSharedErrorMessage(run);
	const sortedQueries = [...run.queries].sort(
		(a, b) => Number(b.status === 'failed') - Number(a.status === 'failed'),
	);

	return (
		<div className='flex flex-col gap-5 px-5 py-4'>
			<RunDetailHeader run={run} />

			{sharedErrorMessage && (
				<SharedFailureCallout
					errorMessage={sharedErrorMessage}
					isRefreshing={isRefreshing}
					onRefresh={onRefresh}
				/>
			)}

			<section className='flex flex-col gap-2'>
				<h3 className='text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
					Queries · {countSucceededQueries(run)} of {run.queries.length} refreshed
				</h3>
				{sortedQueries.map((query) => (
					<QueryOutcomeCard
						key={query.queryId}
						query={query}
						isSelected={query.queryId === selectedQueryId}
						hideError={sharedErrorMessage !== null}
						onViewOnStory={() => onViewQueryOnStory(query.queryId)}
						onFix={sharedErrorMessage ? undefined : () => onFixQuery(run, query)}
					/>
				))}
			</section>
		</div>
	);
}

function RunDetailHeader({ run }: { run: StoryRefreshRun }) {
	return (
		<header className='flex flex-col gap-3'>
			<div className='flex items-center gap-2'>
				<RefreshStatusBadge status={run.status} />
				<span className='font-mono text-[11px] text-muted-foreground'>{run.id}</span>
			</div>
			<h2 className='text-base font-medium'>
				{REFRESH_TRIGGER_LABELS[run.trigger]} refresh · {formatRefreshDate(run.startedAt)}
			</h2>
			<dl className='grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs'>
				<RunFact label='Trigger'>
					<RefreshTriggerLabel trigger={run.trigger} />
				</RunFact>
				<RunFact label='Triggered by'>
					<span className='truncate' title={run.triggeredBy}>
						{run.triggeredBy}
					</span>
				</RunFact>
				<RunFact label='Duration'>
					<span className='tabular-nums'>{formatRefreshDuration(run.durationMs)}</span>
				</RunFact>
			</dl>
		</header>
	);
}

function RunFact({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className='flex min-w-0 flex-col gap-0.5'>
			<dt className='text-muted-foreground'>{label}</dt>
			<dd className='flex min-w-0 font-medium'>{children}</dd>
		</div>
	);
}

function SharedFailureCallout({
	errorMessage,
	isRefreshing,
	onRefresh,
}: {
	errorMessage: string;
	isRefreshing: boolean;
	onRefresh: () => void;
}) {
	return (
		<div className='flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3'>
			<p className='text-xs font-medium text-destructive'>Every query failed with the same error</p>
			<p className='text-xs text-muted-foreground'>
				This usually points at the warehouse connection rather than the queries themselves. Charts kept the data
				from the previous successful refresh.
			</p>
			<pre className='whitespace-pre-wrap break-words rounded-md bg-background/70 p-2 font-mono text-[11px] text-destructive'>
				{errorMessage}
			</pre>
			<Button
				variant='outline'
				size='sm'
				className='w-fit gap-1.5 rounded-full'
				onClick={onRefresh}
				isLoading={isRefreshing}
			>
				<RefreshCw className='size-3' strokeWidth={2.25} />
				Retry refresh now
			</Button>
		</div>
	);
}

function QueryOutcomeCard({
	query,
	isSelected,
	hideError,
	onViewOnStory,
	onFix,
}: {
	query: StoryRefreshQueryOutcome;
	isSelected: boolean;
	hideError: boolean;
	onViewOnStory: () => void;
	onFix?: () => void;
}) {
	const isFailed = query.status === 'failed';
	const [isSqlVisible, setIsSqlVisible] = useState(isFailed && !hideError);
	const KindIcon = BLOCK_KIND_ICONS[query.kind];

	return (
		<div
			className={cn(
				'overflow-hidden rounded-lg border text-xs',
				isFailed && !hideError && 'border-destructive/40',
				isSelected && 'ring-2 ring-primary/40',
			)}
		>
			<div className='flex items-center gap-2 px-3 py-2'>
				<RefreshStatusIcon status={query.status} />
				<KindIcon className='size-3.5 shrink-0 text-muted-foreground' strokeWidth={2} />
				<span className='truncate font-medium'>{query.title || query.queryId}</span>
				<code className='truncate font-mono text-[11px] text-muted-foreground'>{query.queryId}</code>
				<span className='ml-auto shrink-0 tabular-nums text-muted-foreground'>
					{query.rowCount !== null ? `${query.rowCount} ${pluralize('row', query.rowCount)} · ` : ''}
					{formatRefreshDuration(query.durationMs)}
				</span>
			</div>

			{isFailed && !hideError && (
				<pre className='mx-3 mb-2 whitespace-pre-wrap break-words rounded-md bg-destructive/10 p-2 font-mono text-[11px] leading-relaxed text-destructive'>
					{query.errorMessage}
				</pre>
			)}

			{isSqlVisible && (
				<div className='border-t bg-muted/20'>
					<div className='px-3 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
						SQL that ran
					</div>
					<SqlQueryDisplay query={query.sql} className='text-[11px]' />
				</div>
			)}

			<div className={cn('flex items-center gap-1 px-2 py-1.5', isSqlVisible && 'border-t')}>
				<Button
					variant='ghost'
					size='sm'
					className='h-6 gap-1.5 px-2 text-xs'
					onClick={() => setIsSqlVisible((visible) => !visible)}
				>
					<Code className='size-3' strokeWidth={2.25} />
					{isSqlVisible ? 'Hide SQL' : 'Show SQL'}
				</Button>
				<Button variant='ghost' size='sm' className='h-6 gap-1.5 px-2 text-xs' onClick={onViewOnStory}>
					<SquareArrowOutUpRight className='size-3' strokeWidth={2.25} />
					View on story
				</Button>
				{isFailed && onFix && (
					<Button
						variant='outline'
						size='sm'
						className='ml-auto h-6 gap-1.5 rounded-full px-2.5 text-xs'
						onClick={onFix}
					>
						<Sparkles className='size-3' strokeWidth={2.25} />
						Fix with nao
					</Button>
				)}
			</div>
		</div>
	);
}
