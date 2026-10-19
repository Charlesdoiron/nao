import { useCallback, useSyncExternalStore } from 'react';
import type { StoryFeedbackValue } from '@/lib/story-feedback';
import { storyFeedbackStore } from '@/stores/story-feedback';

export function useStoryFeedbackVote(storyId: string) {
	const subscribe = useCallback((callback: () => void) => storyFeedbackStore.subscribe(storyId, callback), [storyId]);
	const vote = useSyncExternalStore(subscribe, () => storyFeedbackStore.getVote(storyId));
	const toggleVote = useCallback((value: StoryFeedbackValue) => storyFeedbackStore.toggle(storyId, value), [storyId]);

	return { vote, toggleVote };
}
