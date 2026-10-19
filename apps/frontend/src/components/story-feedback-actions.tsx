import { useState } from 'react';
import { PanelRightOpen, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { FormEvent } from 'react';

import type { StoryFeedbackFilter } from '@/components/story-feedback-drawer';
import type { StoryFeedbackVote } from '@/stores/story-feedback';
import { StoryFeedbackDrawer } from '@/components/story-feedback-drawer';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePermissions } from '@/hooks/use-permissions';
import { useStoryFeedback } from '@/hooks/use-story-feedback';
import { useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

interface StoryFeedbackActionsProps {
	storyId: string;
	storyTitle: string;
	authorName?: string;
	isOwner: boolean;
}

export function StoryFeedbackActions({ storyId, storyTitle, authorName, isOwner }: StoryFeedbackActionsProps) {
	const { isAdmin } = usePermissions();
	const { data: session } = useSession();
	const ownerName = authorName ?? session?.user?.name ?? 'the owner';
	const { counts, myVote, vote, comment } = useStoryFeedback(storyId);
	const [drawerFilter, setDrawerFilter] = useState<StoryFeedbackFilter | null>(null);
	const [commentVote, setCommentVote] = useState<StoryFeedbackVote | null>(null);

	const canViewDetails = isOwner || isAdmin;

	const handleVoteClick = (clickedVote: StoryFeedbackVote) => {
		if (isOwner) {
			setDrawerFilter(clickedVote);
			return;
		}
		const isRemovingVote = myVote === clickedVote;
		vote(clickedVote);
		setCommentVote(isRemovingVote ? null : clickedVote);
	};

	const handleCommentSubmit = (text: string) => {
		if (text) {
			comment(text);
		}
		setCommentVote(null);
	};

	return (
		<>
			<Popover open={commentVote !== null} onOpenChange={(open) => !open && setCommentVote(null)}>
				<PopoverAnchor asChild>
					<div className='flex items-center gap-0.5 rounded-full border p-0.5'>
						<VoteButton
							vote='up'
							count={counts.up}
							isSelected={myVote === 'up'}
							tooltip={isOwner ? 'See who found this helpful' : 'Helpful'}
							onClick={() => handleVoteClick('up')}
						/>
						<VoteButton
							vote='down'
							count={counts.down}
							isSelected={myVote === 'down'}
							tooltip={isOwner ? 'See who found this not helpful' : 'Not helpful'}
							onClick={() => handleVoteClick('down')}
						/>
						{canViewDetails && (
							<>
								<span className='mx-0.5 h-4 w-px bg-border' />
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant='ghost'
											size='icon-xs'
											className='rounded-full'
											onClick={() => setDrawerFilter('all')}
											aria-label='View feedback'
										>
											<PanelRightOpen className='size-3.5' strokeWidth={2.25} />
										</Button>
									</TooltipTrigger>
									<TooltipContent>View feedback</TooltipContent>
								</Tooltip>
							</>
						)}
					</div>
				</PopoverAnchor>
				<PopoverContent align='end' sideOffset={8} className='w-80 rounded-2xl p-3'>
					{commentVote && (
						<FeedbackCommentForm
							vote={commentVote}
							ownerName={ownerName}
							onSubmit={handleCommentSubmit}
							onSkip={() => setCommentVote(null)}
						/>
					)}
				</PopoverContent>
			</Popover>

			{canViewDetails && (
				<StoryFeedbackDrawer
					open={drawerFilter !== null}
					onOpenChange={(open) => !open && setDrawerFilter(null)}
					filter={drawerFilter ?? 'all'}
					onFilterChange={setDrawerFilter}
					storyId={storyId}
					storyTitle={storyTitle}
					ownerName={ownerName}
				/>
			)}
		</>
	);
}

function VoteButton({
	vote,
	count,
	isSelected,
	tooltip,
	onClick,
}: {
	vote: StoryFeedbackVote;
	count: number;
	isSelected: boolean;
	tooltip: string;
	onClick: () => void;
}) {
	const Icon = vote === 'up' ? ThumbsUp : ThumbsDown;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type='button'
					onClick={onClick}
					aria-pressed={isSelected}
					aria-label={tooltip}
					className={cn(
						'flex h-6 cursor-pointer items-center gap-1 rounded-full px-2 text-xs font-medium tabular-nums transition-colors',
						isSelected
							? vote === 'up'
								? 'bg-green-500/15 text-green-700 dark:text-green-400'
								: 'bg-red-500/15 text-red-600 dark:text-red-400'
							: 'text-muted-foreground hover:bg-accent hover:text-foreground',
					)}
				>
					<Icon className={cn('size-3.5', isSelected && 'fill-current/20')} strokeWidth={2.25} />
					<span>{count}</span>
				</button>
			</TooltipTrigger>
			<TooltipContent>{isSelected ? 'Remove your vote' : tooltip}</TooltipContent>
		</Tooltip>
	);
}

const QUICK_REASONS: Record<StoryFeedbackVote, string[]> = {
	up: ['Accurate numbers', 'Easy to read', 'Saved me time'],
	down: ['Wrong numbers', 'Outdated data', 'Missing breakdown', 'Hard to read'],
};

function FeedbackCommentForm({
	vote,
	ownerName,
	onSubmit,
	onSkip,
}: {
	vote: StoryFeedbackVote;
	ownerName: string;
	onSubmit: (comment: string) => void;
	onSkip: () => void;
}) {
	const [reasons, setReasons] = useState<string[]>([]);
	const [text, setText] = useState('');
	const isPositive = vote === 'up';

	const toggleReason = (reason: string) => {
		setReasons((prev) => (prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]));
	};

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		onSubmit([reasons.join(', '), text.trim()].filter(Boolean).join(' — '));
	};

	return (
		<form onSubmit={handleSubmit} className='flex flex-col gap-2.5'>
			<div className='flex flex-col gap-0.5'>
				<span className='text-sm font-medium'>
					{isPositive ? 'Thanks! What worked well?' : 'Thanks! What should be improved?'}
				</span>
				<span className='text-xs text-muted-foreground'>Shared with {ownerName} and project admins.</span>
			</div>
			<div className='flex flex-wrap gap-1.5'>
				{QUICK_REASONS[vote].map((reason) => (
					<button
						key={reason}
						type='button'
						onClick={() => toggleReason(reason)}
						className={cn(
							'cursor-pointer rounded-full border px-2 py-0.5 text-xs transition-colors',
							reasons.includes(reason)
								? 'border-foreground bg-foreground text-background'
								: 'text-muted-foreground hover:text-foreground',
						)}
					>
						{reason}
					</button>
				))}
			</div>
			<Textarea
				value={text}
				onChange={(event) => setText(event.target.value)}
				placeholder='Add a comment (optional)'
				rows={3}
				className='resize-none bg-panel text-sm'
			/>
			<div className='flex justify-end gap-2'>
				<Button type='button' variant='ghost' size='sm' className='rounded-full' onClick={onSkip}>
					Skip
				</Button>
				<Button type='submit' variant='primary-gradient' size='sm' className='rounded-full'>
					Send
				</Button>
			</div>
		</form>
	);
}
