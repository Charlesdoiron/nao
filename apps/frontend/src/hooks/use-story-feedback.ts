import { useMemo, useSyncExternalStore } from 'react';

import type { StoryItem } from '@/lib/stories-page';
import type { StoryFeedbackSnapshot, StoryFeedbackSubmission } from '@/lib/story-feedback.mock';
import { usePermissions } from '@/hooks/use-permissions';
import { canSeeStoryFeedback, summarizeStoryFeedback } from '@/lib/story-feedback';
import {
	getStoryFeedbackEntries,
	getStoryFeedbackSnapshot,
	markStoryFeedbackReviewed,
	submitStoryFeedback,
	subscribeToStoryFeedback,
} from '@/lib/story-feedback.mock';

export function useStoryItemsWithFeedback(items: StoryItem[]): StoryItem[] {
	const { isAdmin } = usePermissions();
	const feedback = useStoryFeedbackSnapshot();

	return useMemo(
		() =>
			items.map((item) => ({
				...item,
				feedback: canSeeStoryFeedback(item, isAdmin)
					? summarizeStoryFeedback(getStoryFeedbackEntries(feedback, item.storyId))
					: null,
			})),
		[items, isAdmin, feedback],
	);
}

export function useStoryFeedback(storyId: string) {
	const feedback = useStoryFeedbackSnapshot();

	return useMemo(() => {
		const entries = getStoryFeedbackEntries(feedback, storyId);
		return {
			entries,
			summary: summarizeStoryFeedback(entries),
			myEntry: entries.find((entry) => entry.isMine) ?? null,
			submit: (submission: StoryFeedbackSubmission) => submitStoryFeedback(storyId, submission),
			markReviewed: () => markStoryFeedbackReviewed(storyId),
		};
	}, [storyId, feedback]);
}

function useStoryFeedbackSnapshot(): StoryFeedbackSnapshot {
	return useSyncExternalStore(subscribeToStoryFeedback, getStoryFeedbackSnapshot);
}
