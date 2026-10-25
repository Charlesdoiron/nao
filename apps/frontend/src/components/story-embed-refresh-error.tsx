import { CircleAlert, History, Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import type { StoryQueryRefreshFailure } from '@/lib/story-refresh-history';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useStoryRefreshFailures } from '@/contexts/story-refresh-failures';
import { formatRefreshDate } from '@/lib/story-refresh-history';
import { cn } from '@/lib/utils';

/** Keeps the block's last good data visible and flags that its query failed in the latest refresh. */
export function StoryEmbedRefreshError({ queryId, children }: { queryId: string; children: ReactNode }) {
	const context = useStoryRefreshFailures();
	const failure = context?.failures.get(queryId);

	if (!context || !failure) {
		return children;
	}

	return (
		<RefreshErrorFrame
			failure={failure}
			isFocused={context.focusedQueryId === queryId}
			onShowDetails={() => context.onShowDetails(failure)}
			onFix={() => context.onFix(failure)}
		>
			{children}
		</RefreshErrorFrame>
	);
}

function RefreshErrorFrame({
	failure,
	isFocused,
	onShowDetails,
	onFix,
	children,
}: {
	failure: StoryQueryRefreshFailure;
	isFocused: boolean;
	onShowDetails: () => void;
	onFix: () => void;
	children: ReactNode;
}) {
	const frameRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (isFocused) {
			frameRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		}
	}, [isFocused]);

	return (
		<div
			ref={frameRef}
			data-refresh-error-query={failure.query.queryId}
			className={cn(
				'flex flex-col gap-3 rounded-md transition-shadow',
				isFocused && 'ring-2 ring-destructive/40 ring-offset-4 ring-offset-card',
			)}
		>
			<div
				role='alert'
				className='flex items-center gap-2 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs'
			>
				<CircleAlert className='size-3.5 shrink-0 text-destructive' strokeWidth={2.25} />
				<div className='flex min-w-0 flex-col'>
					<span className='font-medium text-destructive'>This query failed in the last refresh</span>
					<Tooltip>
						<TooltipTrigger asChild>
							<span className='truncate text-muted-foreground'>
								{describeStaleData(failure)} · {firstLine(failure.query.errorMessage)}
							</span>
						</TooltipTrigger>
						<TooltipContent className='max-w-md whitespace-pre-wrap font-mono text-[11px]'>
							{failure.query.errorMessage}
						</TooltipContent>
					</Tooltip>
				</div>
				<div className='ml-auto flex shrink-0 items-center gap-1'>
					<Button variant='ghost' size='sm' className='h-7 gap-1.5 px-2 text-xs' onClick={onShowDetails}>
						<History className='size-3' strokeWidth={2.25} />
						Details
					</Button>
					<Button
						variant='outline'
						size='sm'
						className='h-7 gap-1.5 rounded-full bg-background px-2.5 text-xs'
						onClick={onFix}
					>
						<Sparkles className='size-3' strokeWidth={2.25} />
						Fix with nao
					</Button>
				</div>
			</div>
			<div className='opacity-60 saturate-50'>{children}</div>
		</div>
	);
}

function describeStaleData(failure: StoryQueryRefreshFailure): string {
	if (!failure.lastSucceededAt) {
		return 'No successful refresh yet';
	}
	const date = formatRefreshDate(failure.lastSucceededAt).replace(/^(Today|Yesterday)/, (day) => day.toLowerCase());
	return `Showing data from ${date}`;
}

function firstLine(message?: string): string {
	return message?.split('\n')[0] ?? 'Unknown error';
}
