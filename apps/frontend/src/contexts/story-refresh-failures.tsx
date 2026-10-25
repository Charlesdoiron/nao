import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import type { StoryQueryRefreshFailure } from '@/lib/story-refresh-history';

export interface StoryRefreshFailuresValue {
	failures: Map<string, StoryQueryRefreshFailure>;
	focusedQueryId?: string;
	onShowDetails: (failure: StoryQueryRefreshFailure) => void;
	onFix: (failure: StoryQueryRefreshFailure) => void;
}

const StoryRefreshFailuresContext = createContext<StoryRefreshFailuresValue | null>(null);

export function StoryRefreshFailuresProvider({
	value,
	children,
}: {
	value: StoryRefreshFailuresValue | null;
	children: ReactNode;
}) {
	return <StoryRefreshFailuresContext.Provider value={value}>{children}</StoryRefreshFailuresContext.Provider>;
}

export function useStoryRefreshFailures(): StoryRefreshFailuresValue | null {
	return useContext(StoryRefreshFailuresContext);
}
