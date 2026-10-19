import { Link } from '@tanstack/react-router';
import { MessageSquareHeart, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePermissions } from '@/hooks/use-permissions';
import { useStoryFeedbackVote } from '@/hooks/use-story-feedback-vote';
import { getMockStoryFeedbackTotals } from '@/lib/story-feedback.mock';
import { cn } from '@/lib/utils';

interface StoryFeedbackControlProps {
	storyId: string;
	title: string;
	isOwner: boolean;
}

export function StoryFeedbackControl({ storyId, title, isOwner }: StoryFeedbackControlProps) {
	if (isOwner) {
		return <StoryFeedbackTotalsLink storyId={storyId} title={title} />;
	}
	return <StoryFeedbackButtons storyId={storyId} />;
}

export function StoryFeedbackButtons({ storyId }: { storyId: string }) {
	const { vote, toggleVote } = useStoryFeedbackVote(storyId);

	return (
		<div className='flex items-center gap-0.5 rounded-full border p-0.5' role='group' aria-label='Story feedback'>
			<FeedbackButton
				icon={ThumbsUp}
				label='Helpful'
				isActive={vote === 'up'}
				activeClassName='bg-green-500/10 text-green-600 dark:text-green-500'
				onClick={() => toggleVote('up')}
			/>
			<FeedbackButton
				icon={ThumbsDown}
				label='Not helpful'
				isActive={vote === 'down'}
				activeClassName='bg-destructive/10 text-destructive'
				onClick={() => toggleVote('down')}
			/>
		</div>
	);
}

export function StoryFeedbackMenuItem({ title }: { title: string }) {
	const { isAdmin } = usePermissions();

	if (!isAdmin) {
		return null;
	}

	return (
		<DropdownMenuItem asChild>
			<Link to='/stories/feedback' search={{ scope: 'all', q: title }}>
				<MessageSquareHeart strokeWidth={2.25} />
				<span>View feedback</span>
			</Link>
		</DropdownMenuItem>
	);
}

function FeedbackButton({
	icon: Icon,
	label,
	isActive,
	activeClassName,
	onClick,
}: {
	icon: LucideIcon;
	label: string;
	isActive: boolean;
	activeClassName: string;
	onClick: () => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant='ghost'
					className={cn('size-5.5 rounded-full px-2 hover:rounded-full', isActive && activeClassName)}
					onClick={onClick}
					aria-label={label}
					aria-pressed={isActive}
				>
					<Icon className={cn('size-3', isActive && 'fill-current/20')} strokeWidth={2.25} />
				</Button>
			</TooltipTrigger>
			<TooltipContent>{isActive ? 'Remove feedback' : label}</TooltipContent>
		</Tooltip>
	);
}

function StoryFeedbackTotalsLink({ storyId, title }: { storyId: string; title: string }) {
	const totals = getMockStoryFeedbackTotals(storyId, title);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Link
					to='/stories/feedback'
					search={{ q: title }}
					className='flex items-center gap-2 rounded-full border px-2 py-0.75 text-xs font-medium tabular-nums hover:bg-secondary'
				>
					<span className='flex items-center gap-1'>
						<ThumbsUp className='size-3 text-green-600 dark:text-green-500' strokeWidth={2.25} />
						{totals.positive}
					</span>
					<span className='flex items-center gap-1'>
						<ThumbsDown className='size-3 text-destructive' strokeWidth={2.25} />
						{totals.negative}
					</span>
				</Link>
			</TooltipTrigger>
			<TooltipContent>See feedback on this story</TooltipContent>
		</Tooltip>
	);
}
