import { Link } from '@tanstack/react-router';
import { CheckCheck, Lightbulb, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';

import type { StoryFeedbackEntry, StoryFeedbackSentiment } from '@/lib/story-feedback';
import { NewFeedbackDot } from '@/components/story-feedback-counts';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/use-permissions';
import { useStoryFeedback } from '@/hooks/use-story-feedback';
import { getTimeAgo } from '@/lib/time-ago';
import { cn } from '@/lib/utils';

const COLLAPSED_ENTRY_COUNT = 4;

export function StoryFeedbackDetails({
	storyId,
	canReview,
	sentiment = 'all',
}: {
	storyId: string;
	canReview: boolean;
	sentiment?: StoryFeedbackSentiment;
}) {
	const { isAdmin } = usePermissions();
	const { entries, summary, markReviewed } = useStoryFeedback(storyId);
	const [showAll, setShowAll] = useState(false);
	const matchingEntries = entries.filter((entry) => matchesSentiment(entry, sentiment));
	const visibleEntries = showAll ? matchingEntries : matchingEntries.slice(0, COLLAPSED_ENTRY_COUNT);
	const hiddenCount = matchingEntries.length - visibleEntries.length;
	const positiveRate = summary.total > 0 ? Math.round((summary.up / summary.total) * 100) : null;

	return (
		<div className='ml-7 mr-3 mb-2 mt-0.5 rounded-lg border bg-sidebar/60 dark:bg-muted/20'>
			<div className='flex items-center gap-3 border-b px-4 py-2.5'>
				<span className='text-xs font-medium'>
					{summary.total} rating{summary.total === 1 ? '' : 's'}
				</span>
				{positiveRate !== null && (
					<span className='text-xs text-muted-foreground'>{positiveRate}% positive</span>
				)}
				<VersionBreakdown entries={entries} />
				<div className='ml-auto flex items-center gap-1.5'>
					{canReview && summary.newCount > 0 && (
						<Button
							variant='ghost'
							size='sm'
							className='h-7 gap-1.5 rounded-full text-xs'
							onClick={markReviewed}
						>
							<CheckCheck className='size-3.5' />
							Mark as reviewed
						</Button>
					)}
					<Button variant='outline' size='sm' className='h-7 rounded-full text-xs' asChild>
						<Link to='/stories/$storyId' params={{ storyId }}>
							Open story
						</Link>
					</Button>
				</div>
			</div>

			<ul className='divide-y'>
				{visibleEntries.map((entry) => (
					<FeedbackEntryRow key={entry.id} entry={entry} />
				))}
				{visibleEntries.length === 0 && (
					<li className='px-4 py-3 text-xs text-muted-foreground'>No feedback matches this filter.</li>
				)}
				{hiddenCount > 0 && (
					<li>
						<button
							type='button'
							onClick={() => setShowAll(true)}
							className='w-full px-4 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer'
						>
							Show {hiddenCount} more
						</button>
					</li>
				)}
			</ul>

			{isAdmin && summary.down > 0 && (
				<div className='flex items-center gap-2 border-t px-4 py-2 text-xs text-muted-foreground'>
					<Lightbulb className='size-3.5 shrink-0 text-amber-500' />
					<span className='flex-1'>
						Negative feedback on this story is analysed by Context recommendations and can lead to story
						fixes, not only context changes.
					</span>
					<Link
						to='/settings/recommendations'
						search={{ tab: 'recommendations', openChats: undefined }}
						className='shrink-0 font-medium text-foreground hover:underline'
					>
						See recommendations
					</Link>
				</div>
			)}
		</div>
	);
}

function FeedbackEntryRow({ entry }: { entry: StoryFeedbackEntry }) {
	const isPositive = entry.vote === 'up';

	return (
		<li className='flex items-start gap-3 px-4 py-2.5'>
			<span className='mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium'>
				{getInitials(entry.userName)}
			</span>
			<div className='min-w-0 flex-1'>
				<div className='flex flex-wrap items-center gap-1.5'>
					<span className='text-xs font-medium'>
						{entry.isMine ? `${entry.userName} (you)` : entry.userName}
					</span>
					<span
						className={cn(
							'inline-flex items-center',
							isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
						)}
					>
						{isPositive ? <ThumbsUp className='size-3' /> : <ThumbsDown className='size-3' />}
					</span>
					{entry.reasons.map((reason) => (
						<span key={reason} className='rounded-full border bg-background px-1.5 py-px text-[10px]'>
							{reason}
						</span>
					))}
					{entry.isNew && <NewFeedbackDot />}
				</div>
				{entry.comment && <p className='mt-1 text-xs text-muted-foreground'>{entry.comment}</p>}
			</div>
			<span className='shrink-0 text-[11px] text-muted-foreground tabular-nums'>
				v{entry.storyVersion} · {getTimeAgo(entry.createdAt.getTime()).humanReadable}
			</span>
		</li>
	);
}

function VersionBreakdown({ entries }: { entries: StoryFeedbackEntry[] }) {
	const versions = [...new Set(entries.map((entry) => entry.storyVersion))].sort((a, b) => b - a);
	if (versions.length < 2) {
		return null;
	}

	return (
		<span className='hidden items-center gap-2 text-[11px] text-muted-foreground lg:inline-flex'>
			<span className='text-muted-foreground/50'>·</span>
			{versions.map((version) => {
				const versionEntries = entries.filter((entry) => entry.storyVersion === version);
				const down = versionEntries.filter((entry) => entry.vote === 'down').length;
				return (
					<span key={version} className='tabular-nums'>
						v{version}: {versionEntries.length - down}
						<ThumbsUp className='mx-0.5 inline size-2.5' />
						{down}
						<ThumbsDown className='ml-0.5 inline size-2.5' />
					</span>
				);
			})}
		</span>
	);
}

function matchesSentiment(entry: StoryFeedbackEntry, sentiment: StoryFeedbackSentiment): boolean {
	if (sentiment === 'positive') {
		return entry.vote === 'up';
	}
	if (sentiment === 'negative') {
		return entry.vote === 'down';
	}
	return true;
}

function getInitials(name: string): string {
	return name
		.split(' ')
		.map((part) => part[0])
		.join('')
		.slice(0, 2)
		.toUpperCase();
}
