import { useMemo, useSyncExternalStore } from 'react';

import type { StoryFeedbackEntry, StoryFeedbackStorySummary, StoryFeedbackVote } from '@/stores/story-feedback';
import { useSession } from '@/lib/auth-client';
import { buildOtherStorySummaries, buildStoryEntries, storyFeedbackStore } from '@/stores/story-feedback';

export interface StoryFeedbackCounts {
	up: number;
	down: number;
	comments: number;
}

export function useStoryFeedback(storyId: string) {
	const state = useSyncExternalStore(storyFeedbackStore.subscribe, storyFeedbackStore.getSnapshot);
	const { data: session } = useSession();
	const myName = session?.user?.name ?? 'You';
	const mine = state[storyId];

	const entries = useMemo(() => buildStoryEntries(storyId, mine, myName), [storyId, mine, myName]);
	const counts = useMemo(() => countFeedback(entries), [entries]);

	return {
		entries,
		counts,
		myVote: mine?.vote ?? null,
		vote: (vote: StoryFeedbackVote) => storyFeedbackStore.vote(storyId, vote),
		comment: (comment: string) => storyFeedbackStore.comment(storyId, comment),
	};
}

export function useAllStoriesFeedback(storyId: string, title: string, ownerName: string) {
	const { entries } = useStoryFeedback(storyId);

	return useMemo<StoryFeedbackStorySummary[]>(
		() =>
			[{ storyId, title, ownerName, isPinned: true, entries }, ...buildOtherStorySummaries()].sort(
				byMostNegative,
			),
		[storyId, title, ownerName, entries],
	);
}

export function countFeedback(entries: StoryFeedbackEntry[]): StoryFeedbackCounts {
	return {
		up: entries.filter((entry) => entry.vote === 'up').length,
		down: entries.filter((entry) => entry.vote === 'down').length,
		comments: entries.filter((entry) => entry.comment).length,
	};
}

function byMostNegative(a: StoryFeedbackStorySummary, b: StoryFeedbackStorySummary) {
	return negativeShare(b.entries) - negativeShare(a.entries);
}

function negativeShare(entries: StoryFeedbackEntry[]) {
	if (entries.length === 0) {
		return 0;
	}
	return countFeedback(entries).down / entries.length;
}
