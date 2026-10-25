import { CircleAlert } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useStoryQueryFailure, useStoryRefreshHistory } from '@/contexts/story-refresh-history';
import { formatRunDate } from '@/lib/story-refresh-history';

export function StoryQueryErrorBadge({ queryId }: { queryId: string }) {
	const history = useStoryRefreshHistory();
	const failure = useStoryQueryFailure(queryId);
	if (!history || !failure) {
		return null;
	}

	const { run, query, lastSucceededAt } = failure;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type='button'
					onClick={() => history.open({ runId: run.id, queryId: query.queryId })}
					className='inline-flex h-5 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-destructive/10 px-2 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/15'
				>
					<CircleAlert className='size-3' strokeWidth={2.25} />
					<span>Refresh failed</span>
				</button>
			</TooltipTrigger>
			<TooltipContent className='max-w-72'>
				<div className='flex flex-col gap-1'>
					<span className='font-medium'>
						{lastSucceededAt
							? `Showing data from ${formatRunDate(lastSucceededAt)}`
							: 'No successful refresh yet'}
					</span>
					<span className='line-clamp-2 opacity-80'>{query.errorMessage}</span>
					<span className='opacity-60'>Click to see the query and fix it</span>
				</div>
			</TooltipContent>
		</Tooltip>
	);
}
