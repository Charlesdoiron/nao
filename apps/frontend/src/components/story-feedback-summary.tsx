import { AlertTriangle, MessageSquareHeart, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { StoryFeedbackSummary } from '@/lib/story-feedback';
import { formatApprovalRate } from '@/lib/story-feedback';
import { cn } from '@/lib/utils';

export function StoryFeedbackSummaryCards({ summary }: { summary: StoryFeedbackSummary }) {
	return (
		<div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
			<SummaryCard
				icon={MessageSquareHeart}
				label='Total feedback'
				value={summary.totalVotes}
				hint={`${formatApprovalRate(summary.approvalRate)} positive`}
			/>
			<SummaryCard
				icon={ThumbsUp}
				label='Positive'
				value={summary.positiveCount}
				iconClassName='text-green-600 dark:text-green-500'
			/>
			<SummaryCard
				icon={ThumbsDown}
				label='Negative'
				value={summary.negativeCount}
				iconClassName='text-destructive'
			/>
			<SummaryCard
				icon={AlertTriangle}
				label='Needs attention'
				value={summary.storiesNeedingAttention}
				hint='Under 50% positive'
				iconClassName='text-amber-500'
			/>
		</div>
	);
}

function SummaryCard({
	icon: Icon,
	label,
	value,
	hint,
	iconClassName,
}: {
	icon: LucideIcon;
	label: string;
	value: number;
	hint?: string;
	iconClassName?: string;
}) {
	return (
		<div className='flex flex-col gap-1 rounded-lg border px-4 py-3'>
			<div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
				<Icon className={cn('size-3.5', iconClassName)} strokeWidth={2.25} />
				<span>{label}</span>
			</div>
			<div className='flex items-baseline gap-2'>
				<span className='text-2xl font-semibold tabular-nums'>{value}</span>
				{hint && <span className='text-xs text-muted-foreground'>{hint}</span>}
			</div>
		</div>
	);
}
