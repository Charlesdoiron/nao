import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ChevronRight, Lightbulb, MessageSquare, Pin, ThumbsDown, ThumbsUp } from 'lucide-react';

import type { StoryFeedbackCounts } from '@/hooks/use-story-feedback';
import type { StoryFeedbackEntry, StoryFeedbackStorySummary, StoryFeedbackVote } from '@/stores/story-feedback';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { usePermissions } from '@/hooks/use-permissions';
import { countFeedback, useAllStoriesFeedback, useStoryFeedback } from '@/hooks/use-story-feedback';
import { formatDate } from '@/lib/analytics-events.utils';
import { cn } from '@/lib/utils';

export type StoryFeedbackFilter = 'all' | StoryFeedbackVote;

type FeedbackScope = 'story' | 'all-stories';

interface StoryFeedbackDrawerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	filter: StoryFeedbackFilter;
	onFilterChange: (filter: StoryFeedbackFilter) => void;
	storyId: string;
	storyTitle: string;
	ownerName: string;
}

export function StoryFeedbackDrawer({ open, onOpenChange, ...props }: StoryFeedbackDrawerProps) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent aria-describedby={undefined}>
				<StoryFeedbackDrawerBody {...props} />
			</SheetContent>
		</Sheet>
	);
}

function StoryFeedbackDrawerBody({
	filter,
	onFilterChange,
	storyId,
	storyTitle,
	ownerName,
}: Omit<StoryFeedbackDrawerProps, 'open' | 'onOpenChange'>) {
	const { isAdmin } = usePermissions();
	const [scope, setScope] = useState<FeedbackScope>('story');
	const [drilledStoryId, setDrilledStoryId] = useState<string | null>(null);
	const { entries } = useStoryFeedback(storyId);
	const allStories = useAllStoriesFeedback(storyId, storyTitle, ownerName);

	const drilledStory = allStories.find((story) => story.storyId === drilledStoryId);
	const isAllStoriesList = scope === 'all-stories' && !drilledStory;

	const handleScopeChange = (nextScope: FeedbackScope) => {
		setScope(nextScope);
		setDrilledStoryId(null);
		onFilterChange('all');
	};

	return (
		<>
			<SheetHeader>
				<SheetTitle>Story feedback</SheetTitle>
				<SheetDescription>
					{isAllStoriesList ? 'Every story in this project' : (drilledStory?.title ?? storyTitle)}
				</SheetDescription>
				{isAdmin && <ScopeToggle scope={scope} onScopeChange={handleScopeChange} />}
			</SheetHeader>

			<div className='flex min-h-0 flex-1 flex-col overflow-y-auto'>
				{isAllStoriesList ? (
					<AllStoriesFeedback
						stories={allStories}
						currentStoryId={storyId}
						onSelectStory={(id) => {
							setDrilledStoryId(id);
							onFilterChange('all');
						}}
					/>
				) : (
					<>
						{drilledStory && (
							<button
								type='button'
								onClick={() => setDrilledStoryId(null)}
								className='flex cursor-pointer items-center gap-1.5 px-4 pt-3 text-xs text-muted-foreground hover:text-foreground'
							>
								<ArrowLeft className='size-3' />
								All stories
							</button>
						)}
						<StoryFeedbackDetail
							entries={drilledStory?.entries ?? entries}
							filter={filter}
							onFilterChange={onFilterChange}
							showRecommendationTags={isAdmin}
						/>
					</>
				)}
			</div>

			{isAdmin && <RecommendationsFooter />}
		</>
	);
}

function ScopeToggle({
	scope,
	onScopeChange,
}: {
	scope: FeedbackScope;
	onScopeChange: (scope: FeedbackScope) => void;
}) {
	const options: { value: FeedbackScope; label: string }[] = [
		{ value: 'story', label: 'This story' },
		{ value: 'all-stories', label: 'All stories' },
	];

	return (
		<div className='mt-2 flex w-fit items-center gap-0.5 rounded-full border p-0.5'>
			{options.map((option) => (
				<button
					key={option.value}
					type='button'
					onClick={() => onScopeChange(option.value)}
					className={cn(
						'cursor-pointer rounded-full px-3 py-0.5 text-xs transition-colors',
						scope === option.value
							? 'bg-accent font-medium text-foreground'
							: 'text-muted-foreground hover:text-foreground',
					)}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}

function StoryFeedbackDetail({
	entries,
	filter,
	onFilterChange,
	showRecommendationTags,
}: {
	entries: StoryFeedbackEntry[];
	filter: StoryFeedbackFilter;
	onFilterChange: (filter: StoryFeedbackFilter) => void;
	showRecommendationTags: boolean;
}) {
	const counts = countFeedback(entries);
	const visibleEntries = filter === 'all' ? entries : entries.filter((entry) => entry.vote === filter);

	return (
		<div className='flex flex-col'>
			<div className='p-4'>
				<FeedbackSummaryCard counts={counts} />
			</div>
			<FilterTabs counts={counts} filter={filter} onFilterChange={onFilterChange} />
			{visibleEntries.length === 0 ? (
				<p className='py-10 text-center text-xs text-muted-foreground'>No feedback yet.</p>
			) : (
				<ul className='divide-y'>
					{visibleEntries.map((entry) => (
						<FeedbackEntryRow key={entry.id} entry={entry} showRecommendationTag={showRecommendationTags} />
					))}
				</ul>
			)}
		</div>
	);
}

function FeedbackSummaryCard({ counts }: { counts: StoryFeedbackCounts }) {
	const total = counts.up + counts.down;
	const helpfulShare = total === 0 ? 0 : Math.round((counts.up / total) * 100);

	return (
		<div className='flex flex-col gap-2.5 rounded-2xl border bg-muted/30 p-3'>
			<div className='flex items-baseline gap-2'>
				<span className='text-2xl font-semibold tabular-nums'>{helpfulShare}%</span>
				<span className='text-xs text-muted-foreground'>
					found it helpful · {total} vote{total === 1 ? '' : 's'}
				</span>
			</div>
			<RatioBar up={counts.up} down={counts.down} />
			<div className='flex items-center gap-3 text-xs text-muted-foreground'>
				<span className='flex items-center gap-1'>
					<ThumbsUp className='size-3 text-green-600 dark:text-green-400' />
					{counts.up} helpful
				</span>
				<span className='flex items-center gap-1'>
					<ThumbsDown className='size-3 text-red-500 dark:text-red-400' />
					{counts.down} not helpful
				</span>
				<span className='flex items-center gap-1'>
					<MessageSquare className='size-3' />
					{counts.comments} comments
				</span>
			</div>
		</div>
	);
}

function RatioBar({ up, down, className }: { up: number; down: number; className?: string }) {
	const total = up + down;
	const upShare = total === 0 ? 0 : (up / total) * 100;

	return (
		<div className={cn('flex h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}>
			<div className='bg-green-500' style={{ width: `${upShare}%` }} />
			<div className='bg-red-400' style={{ width: `${total === 0 ? 0 : 100 - upShare}%` }} />
		</div>
	);
}

function FilterTabs({
	counts,
	filter,
	onFilterChange,
}: {
	counts: StoryFeedbackCounts;
	filter: StoryFeedbackFilter;
	onFilterChange: (filter: StoryFeedbackFilter) => void;
}) {
	const tabs: { value: StoryFeedbackFilter; label: string; count: number }[] = [
		{ value: 'all', label: 'All', count: counts.up + counts.down },
		{ value: 'up', label: 'Helpful', count: counts.up },
		{ value: 'down', label: 'Not helpful', count: counts.down },
	];

	return (
		<div className='flex border-b px-4'>
			{tabs.map((tab) => (
				<button
					key={tab.value}
					type='button'
					onClick={() => onFilterChange(tab.value)}
					className={cn(
						'-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-xs transition-colors',
						filter === tab.value
							? 'border-primary font-medium text-foreground'
							: 'border-transparent text-muted-foreground hover:text-foreground',
					)}
				>
					{tab.label}
					<span className='text-muted-foreground/70 tabular-nums'>{tab.count}</span>
				</button>
			))}
		</div>
	);
}

function FeedbackEntryRow({
	entry,
	showRecommendationTag,
}: {
	entry: StoryFeedbackEntry;
	showRecommendationTag: boolean;
}) {
	const VoteIcon = entry.vote === 'up' ? ThumbsUp : ThumbsDown;

	return (
		<li className={cn('flex gap-3 px-4 py-3', entry.isMine && 'bg-primary/5')}>
			<Avatar username={entry.authorName} size='sm' className='mt-0.5 shrink-0' />
			<div className='flex min-w-0 flex-1 flex-col gap-1'>
				<div className='flex items-center gap-1.5 text-xs'>
					<span className='truncate font-medium'>
						{entry.authorName}
						{entry.isMine && <span className='font-normal text-muted-foreground'> (you)</span>}
					</span>
					<VoteIcon
						className={cn(
							'size-3 shrink-0',
							entry.vote === 'up'
								? 'text-green-600 dark:text-green-400'
								: 'text-red-500 dark:text-red-400',
						)}
					/>
					<span className='ml-auto shrink-0 text-muted-foreground'>
						{formatDate(entry.createdAt)} · v.{entry.versionNumber}
					</span>
				</div>
				{entry.comment && <p className='text-sm leading-snug'>{entry.comment}</p>}
				{showRecommendationTag && entry.isInRecommendations && (
					<Badge variant='secondary' className='w-fit gap-1 px-1.5 py-0 text-[10px] font-medium'>
						<Lightbulb className='size-2.5' />
						In context recommendations
					</Badge>
				)}
			</div>
		</li>
	);
}

function AllStoriesFeedback({
	stories,
	currentStoryId,
	onSelectStory,
}: {
	stories: StoryFeedbackStorySummary[];
	currentStoryId: string;
	onSelectStory: (storyId: string) => void;
}) {
	const allEntries = stories.flatMap((story) => story.entries);
	const needsAttention = stories.filter((story) => {
		const counts = countFeedback(story.entries);
		return counts.down >= counts.up && counts.down > 0;
	}).length;

	return (
		<div className='flex flex-col'>
			<div className='flex flex-col gap-2 p-4'>
				<FeedbackSummaryCard counts={countFeedback(allEntries)} />
				{needsAttention > 0 && (
					<p className='text-xs text-muted-foreground'>
						<span className='font-medium text-red-600 dark:text-red-400'>
							{needsAttention} {needsAttention === 1 ? 'story needs' : 'stories need'} attention
						</span>{' '}
						— as many negative votes as positive ones.
					</p>
				)}
			</div>
			<div className='border-y bg-muted/30 px-4 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase'>
				Sorted by most negative
			</div>
			<ul className='divide-y'>
				{stories.map((story) => (
					<StoryFeedbackRow
						key={story.storyId}
						story={story}
						isCurrent={story.storyId === currentStoryId}
						onSelect={() => onSelectStory(story.storyId)}
					/>
				))}
			</ul>
		</div>
	);
}

function StoryFeedbackRow({
	story,
	isCurrent,
	onSelect,
}: {
	story: StoryFeedbackStorySummary;
	isCurrent: boolean;
	onSelect: () => void;
}) {
	const counts = countFeedback(story.entries);
	const latestComment = story.entries.find((entry) => entry.comment);

	return (
		<li>
			<button
				type='button'
				onClick={onSelect}
				className='flex w-full cursor-pointer flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-muted/40'
			>
				<div className='flex items-center gap-1.5'>
					<span className='truncate text-sm font-medium'>{story.title}</span>
					{story.isPinned && <Pin className='size-3 shrink-0 text-muted-foreground' />}
					{isCurrent && (
						<Badge variant='secondary' className='px-1.5 py-0 text-[10px]'>
							Current
						</Badge>
					)}
					<ChevronRight className='ml-auto size-3.5 shrink-0 text-muted-foreground' />
				</div>
				<div className='flex items-center gap-3 text-xs text-muted-foreground'>
					<span className='truncate'>by {story.ownerName}</span>
					<span className='ml-auto flex shrink-0 items-center gap-1'>
						<ThumbsUp className='size-3' />
						{counts.up}
					</span>
					<span className='flex shrink-0 items-center gap-1'>
						<ThumbsDown className='size-3' />
						{counts.down}
					</span>
					<span className='flex shrink-0 items-center gap-1'>
						<MessageSquare className='size-3' />
						{counts.comments}
					</span>
				</div>
				<RatioBar up={counts.up} down={counts.down} />
				{latestComment && (
					<p className='truncate text-xs text-muted-foreground italic'>“{latestComment.comment}”</p>
				)}
			</button>
		</li>
	);
}

function RecommendationsFooter() {
	return (
		<div className='flex items-start gap-2.5 border-t bg-muted/30 p-4 text-xs'>
			<Lightbulb className='mt-0.5 size-3.5 shrink-0 text-amber-500' />
			<div className='flex flex-col gap-1.5'>
				<p className='text-muted-foreground'>
					Negative feedback with a comment is analysed in{' '}
					<span className='font-medium text-foreground'>Context recommendations</span>. Issues specific to a
					story (wrong numbers, missing breakdown) are suggested as story fixes rather than context changes.
				</p>
				<Button asChild variant='outline' size='sm' className='w-fit rounded-full text-xs'>
					<Link to='/settings/recommendations' search={{ tab: 'recommendations', openChats: undefined }}>
						Open recommendations
					</Link>
				</Button>
			</div>
		</div>
	);
}
