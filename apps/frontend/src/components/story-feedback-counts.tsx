import { ThumbsDown, ThumbsUp } from 'lucide-react';

import type { StoryFeedbackSummary } from '@/lib/story-feedback';
import { cn } from '@/lib/utils';

export function StoryFeedbackCounts({
	summary,
	size = 'sm',
	showNew = true,
	className,
}: {
	summary: StoryFeedbackSummary;
	size?: 'xs' | 'sm';
	showNew?: boolean;
	className?: string;
}) {
	const iconClass = size === 'xs' ? 'size-2.5' : 'size-3';
	const textClass = size === 'xs' ? 'text-[10px]' : 'text-xs';

	return (
		<span className={cn('inline-flex items-center gap-2 tabular-nums', textClass, className)}>
			<span className={cn('inline-flex items-center gap-1', summary.up > 0 ? 'text-foreground' : 'opacity-40')}>
				<ThumbsUp className={iconClass} />
				{summary.up}
			</span>
			<span
				className={cn(
					'inline-flex items-center gap-1',
					summary.down > 0 ? 'text-red-600 dark:text-red-400' : 'opacity-40',
				)}
			>
				<ThumbsDown className={iconClass} />
				{summary.down}
			</span>
			{showNew && summary.newCount > 0 && <NewFeedbackDot count={summary.newCount} />}
		</span>
	);
}

export function NewFeedbackDot({ count }: { count?: number }) {
	return (
		<span className='inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary'>
			<span className='size-1.5 rounded-full bg-primary' />
			{count ? `${count} new` : 'New'}
		</span>
	);
}
