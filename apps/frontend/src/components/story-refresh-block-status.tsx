import { CircleAlert, History, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

import type { StoryRefreshBlockState } from '@/contexts/story-refresh-history';
import { Button } from '@/components/ui/button';
import { useStoryRefreshBlockState, useStoryRefreshHistory } from '@/contexts/story-refresh-history';
import { formatRefreshDate, getStoryBlockAnchorId } from '@/lib/story-refresh-history';
import { cn } from '@/lib/utils';

export function StoryRefreshBlockStatus({ queryId, children }: { queryId: string; children: ReactNode }) {
	const state = useStoryRefreshBlockState(queryId);
	if (!state) {
		return <>{children}</>;
	}

	const isFailing = state.latestResult.status === 'failed';
	const showErrorState = isFailing || state.isHighlighted;

	return (
		<div
			id={getStoryBlockAnchorId(queryId)}
			data-refresh-chart-status={state.latestResult.status}
			className={cn(
				'scroll-mt-4 rounded-xl transition-[opacity,box-shadow] duration-200',
				showErrorState && 'border border-dashed border-destructive/40 p-3',
				state.isHighlighted && 'border-solid ring-2 ring-destructive/40 ring-offset-2 ring-offset-background',
				state.isDimmed && 'opacity-35',
			)}
		>
			{showErrorState && <BlockErrorStrip state={state} isFailing={isFailing} />}
			<div className={cn(isFailing && 'opacity-60 saturate-50')}>{children}</div>
		</div>
	);
}

function BlockErrorStrip({ state, isFailing }: { state: StoryRefreshBlockState; isFailing: boolean }) {
	const history = useStoryRefreshHistory();
	const failedResult = isFailing ? state.latestResult : state.selectedResult;
	const failedRun = isFailing ? state.latestRun : history?.selectedRun;
	if (!failedResult || !failedRun) {
		return null;
	}

	return (
		<div className='mb-3 flex flex-col gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs'>
			<div className='flex items-center gap-1.5'>
				<CircleAlert className='size-3.5 shrink-0 text-destructive' strokeWidth={2.25} />
				<span className='font-medium text-destructive'>
					{isFailing ? 'Refresh failed' : 'Failed in the selected run'}
				</span>
				<span className='truncate text-muted-foreground'>
					· {isFailing ? describeStaleData(state.lastSuccessAt) : 'refreshed successfully since'}
				</span>
			</div>
			<p
				className='line-clamp-2 font-mono text-[11px] leading-relaxed break-words text-destructive/80'
				title={failedResult.errorMessage}
			>
				{failedResult.errorMessage}
			</p>
			<div className='flex items-center justify-end gap-1.5'>
				<Button
					variant='ghost'
					size='sm'
					className='h-7 gap-1.5 rounded-full text-xs'
					onClick={() => history?.revealRun(failedRun.id)}
				>
					<History className='size-3.5' strokeWidth={2.25} />
					SQL & details
				</Button>
				{isFailing && (
					<Button
						variant='outline'
						size='sm'
						className='h-7 gap-1.5 rounded-full bg-background text-xs'
						onClick={() => history?.fixWithNao(failedRun, failedResult)}
					>
						<Sparkles className='size-3.5' strokeWidth={2.25} />
						Fix with nao
					</Button>
				)}
			</div>
		</div>
	);
}

function describeStaleData(lastSuccessAt: Date | null) {
	if (!lastSuccessAt) {
		return 'no successful refresh yet';
	}
	return `showing data from ${formatRefreshDate(lastSuccessAt)}`;
}
