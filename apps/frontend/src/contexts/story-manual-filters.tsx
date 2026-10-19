import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import type { ManualFilter } from '@/lib/story-manual-filters';

const EMPTY_FILTERS: ManualFilter[] = [];

const StoryManualFiltersContext = createContext<ManualFilter[] | null>(null);

export function StoryManualFiltersProvider({ filters, children }: { filters: ManualFilter[]; children: ReactNode }) {
	return <StoryManualFiltersContext.Provider value={filters}>{children}</StoryManualFiltersContext.Provider>;
}

/** Story views that host the manual filter bar also expose per-block view controls. */
export function useStoryViewControlsEnabled(): boolean {
	return useContext(StoryManualFiltersContext) !== null;
}

export function useManualFiltersForQuery(queryId: string): ManualFilter[] {
	const filters = useContext(StoryManualFiltersContext) ?? EMPTY_FILTERS;
	return useMemo(
		() => filters.filter((filter) => filter.targets.some((target) => target.queryId === queryId)),
		[filters, queryId],
	);
}
