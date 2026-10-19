import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import type { StoryDashboardEdit } from '@/hooks/use-story-dashboard-edit';

const StoryDashboardEditContext = createContext<StoryDashboardEdit | null>(null);

export function StoryDashboardEditProvider({ value, children }: { value: StoryDashboardEdit; children: ReactNode }) {
	return <StoryDashboardEditContext.Provider value={value}>{children}</StoryDashboardEditContext.Provider>;
}

export function useStoryDashboardEditContext(): StoryDashboardEdit | null {
	return useContext(StoryDashboardEditContext);
}
