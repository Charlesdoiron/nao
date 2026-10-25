import { createContext, useContext } from 'react';

import type {
	StoryQueryFailure,
	StoryRefreshHistoryFocus,
	StoryRefreshQueryResult,
	StoryRefreshRun,
} from '@/lib/story-refresh-history';

export interface StoryRefreshHistoryValue {
	runs: StoryRefreshRun[];
	failuresByQueryId: Map<string, StoryQueryFailure>;
	scheduleDescription?: string | null;
	isOpen: boolean;
	focus: StoryRefreshHistoryFocus | null;
	open: (focus?: StoryRefreshHistoryFocus) => void;
	close: () => void;
	toggle: () => void;
	showInStory: (queryId: string) => void;
	fixWithNao: (run: StoryRefreshRun, query: StoryRefreshQueryResult) => void;
}

export const StoryRefreshHistoryContext = createContext<StoryRefreshHistoryValue | null>(null);

export function useStoryRefreshHistory() {
	return useContext(StoryRefreshHistoryContext);
}

export function useStoryQueryFailure(queryId: string): StoryQueryFailure | null {
	return useStoryRefreshHistory()?.failuresByQueryId.get(queryId) ?? null;
}
