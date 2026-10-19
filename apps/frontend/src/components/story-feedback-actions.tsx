import { Link } from '@tanstack/react-router';
import { ArrowRight, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';

import type { StoryFeedbackEntry, StoryFeedbackVote } from '@/lib/story-feedback';
import { StoryFeedbackCounts } from '@/components/story-feedback-counts';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePermissions } from '@/hooks/use-permissions';
import { useStoryFeedback } from '@/hooks/use-story-feedback';
import { useSession } from '@/lib/auth-client';
import { NEGATIVE_FEEDBACK_REASONS, POSITIVE_FEEDBACK_REASONS } from '@/lib/story-feedback';
import { getTimeAgo } from '@/lib/time-ago';
import { cn } from '@/lib/utils';

export function StoryFeedbackActions({ storyId, isOwner }: { storyId: string; isOwner: boolean }) {
	const { isAdmin } = usePermissions();
	const canReview = isOwner || isAdmin;

	return (
		<div className='flex items-center gap-1'>
			{canReview && <StoryFeedbackSummaryPopover storyId={storyId} />}
			{!isOwner && <StoryFeedbackVoteButtons storyId={storyId} />}
		</div>
	);
}

function StoryFeedbackVoteButtons({ storyId }: { storyId: string }) {
	const { data: session } = useSession();
	const { myEntry, submit } = useStoryFeedback(storyId);
	const [pendingVote, setPendingVote] = useState<StoryFeedbackVote | null>(null);

	function handleSubmit(reasons: string[], comment?: string) {
		if (!pendingVote) {
			return;
		}
		submit({ vote: pendingVote, reasons, comment, userName: session?.user?.name ?? 'You' });
		setPendingVote(null);
	}

	return (
		<Popover open={pendingVote !== null} onOpenChange={(open) => !open && setPendingVote(null)}>
			<PopoverAnchor asChild>
				<div className='flex items-center rounded-full border p-0.5'>
					<VoteButton
						vote='up'
						isSelected={myEntry?.vote === 'up'}
						isPending={pendingVote === 'up'}
						onClick={() => setPendingVote('up')}
					/>
					<VoteButton
						vote='down'
						isSelected={myEntry?.vote === 'down'}
						isPending={pendingVote === 'down'}
						onClick={() => setPendingVote('down')}
					/>
				</div>
			</PopoverAnchor>
			<PopoverContent align='end' className='w-80 p-0'>
				{pendingVote && <FeedbackForm key={pendingVote} vote={pendingVote} onSubmit={handleSubmit} />}
			</PopoverContent>
		</Popover>
	);
}

function VoteButton({
	vote,
	isSelected,
	isPending,
	onClick,
}: {
	vote: StoryFeedbackVote;
	isSelected: boolean;
	isPending: boolean;
	onClick: () => void;
}) {
	const label = vote === 'up' ? 'This story is helpful' : 'This story needs work';
	const Icon = vote === 'up' ? ThumbsUp : ThumbsDown;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant='ghost'
					size='icon-xs'
					onClick={onClick}
					aria-pressed={isSelected}
					aria-label={label}
					className={cn(
						'rounded-full hover:rounded-full',
						(isSelected || isPending) && 'bg-accent',
						isSelected && vote === 'up' && 'text-emerald-600 dark:text-emerald-400',
						isSelected && vote === 'down' && 'text-red-600 dark:text-red-400',
					)}
				>
					<Icon className={cn('size-3.5', isSelected && 'fill-current/20')} strokeWidth={2.25} />
				</Button>
			</TooltipTrigger>
			<TooltipContent>{isSelected ? 'Your rating — click to change' : label}</TooltipContent>
		</Tooltip>
	);
}

function FeedbackForm({
	vote,
	onSubmit,
}: {
	vote: StoryFeedbackVote;
	onSubmit: (reasons: string[], comment?: string) => void;
}) {
	const [reasons, setReasons] = useState<string[]>([]);
	const [comment, setComment] = useState('');
	const isPositive = vote === 'up';
	const options = isPositive ? POSITIVE_FEEDBACK_REASONS : NEGATIVE_FEEDBACK_REASONS;

	function toggleReason(reason: string) {
		setReasons((prev) => (prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]));
	}

	function submit() {
		onSubmit(reasons, comment.trim() || undefined);
	}

	function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			submit();
		}
	}

	return (
		<div className='flex flex-col gap-3 p-4'>
			<div>
				<p className='text-sm font-medium'>
					{isPositive ? 'What makes this story useful?' : 'What could be better?'}
				</p>
				<p className='mt-0.5 text-xs text-muted-foreground'>Visible to the story owner and project admins.</p>
			</div>
			<div className='flex flex-wrap gap-1.5'>
				{options.map((reason) => (
					<button
						key={reason}
						type='button'
						onClick={() => toggleReason(reason)}
						aria-pressed={reasons.includes(reason)}
						className={cn(
							'rounded-full border px-2.5 py-1 text-xs transition-colors cursor-pointer',
							reasons.includes(reason)
								? 'border-foreground/30 bg-accent text-foreground'
								: 'text-muted-foreground hover:text-foreground',
						)}
					>
						{reason}
					</button>
				))}
			</div>
			<Textarea
				value={comment}
				onChange={(e) => setComment(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={isPositive ? 'Anything to add? (optional)' : 'Tell the owner what to fix (optional)'}
				rows={3}
				className='resize-none bg-panel text-sm'
			/>
			<div className='flex items-center justify-end gap-2'>
				<Button variant='ghost' size='sm' className='rounded-full text-xs' onClick={() => onSubmit([])}>
					Just rate
				</Button>
				<Button variant='primary-gradient' size='sm' className='rounded-full text-xs' onClick={submit}>
					Send feedback
				</Button>
			</div>
		</div>
	);
}

function StoryFeedbackSummaryPopover({ storyId }: { storyId: string }) {
	const { entries, summary } = useStoryFeedback(storyId);
	const recentEntries = [...entries].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 3);

	return (
		<Popover>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<button
							type='button'
							className='flex h-7 items-center rounded-full border px-2.5 text-muted-foreground hover:bg-secondary cursor-pointer'
							aria-label='Story feedback'
						>
							<StoryFeedbackCounts summary={summary} />
						</button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent>Feedback from readers</TooltipContent>
			</Tooltip>
			<PopoverContent align='end' className='w-96 p-0'>
				<div className='flex items-center justify-between border-b px-4 py-2.5'>
					<span className='text-sm font-medium'>Reader feedback</span>
					<StoryFeedbackCounts summary={summary} />
				</div>
				{recentEntries.length === 0 ? (
					<p className='px-4 py-6 text-center text-xs text-muted-foreground'>No feedback yet.</p>
				) : (
					<ul className='divide-y'>
						{recentEntries.map((entry) => (
							<RecentFeedbackRow key={entry.id} entry={entry} />
						))}
					</ul>
				)}
				<div className='border-t px-4 py-2'>
					<Link
						to='/stories'
						search={{ folderId: null, feedbackStoryId: storyId }}
						className='inline-flex items-center gap-1 text-xs font-medium hover:underline'
					>
						Review all feedback in Stories
						<ArrowRight className='size-3' />
					</Link>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function RecentFeedbackRow({ entry }: { entry: StoryFeedbackEntry }) {
	const isPositive = entry.vote === 'up';

	return (
		<li className='flex items-start gap-2.5 px-4 py-2.5'>
			<span
				className={cn(
					'mt-0.5 shrink-0',
					isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
				)}
			>
				{isPositive ? <ThumbsUp className='size-3.5' /> : <ThumbsDown className='size-3.5' />}
			</span>
			<div className='min-w-0 flex-1'>
				<div className='flex items-center gap-1.5 text-xs'>
					<span className='font-medium'>{entry.userName}</span>
					<span className='text-muted-foreground'>
						· {getTimeAgo(entry.createdAt.getTime()).humanReadable}
					</span>
				</div>
				<p className='mt-0.5 line-clamp-2 text-xs text-muted-foreground'>
					{entry.comment ?? (entry.reasons.join(', ') || 'No comment')}
				</p>
			</div>
		</li>
	);
}
