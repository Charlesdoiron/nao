import { useCallback, useMemo, useState } from 'react';
import { splitCodeIntoSegments } from '@nao/shared/story-segments';
import { stripStoryTabsMarkup } from '@nao/shared/story-tabs';

import type { QueryDataMap } from '@/components/story-embeds';
import type { ManualFilter } from '@/lib/story-manual-filters';
import {
	applyManualFilters,
	collectStoryBlocks,
	discoverFilterFields,
	isManualFilterActive,
} from '@/lib/story-manual-filters';

export function useStoryManualFilters({ code, queryData }: { code: string; queryData: QueryDataMap | null }) {
	const blocks = useMemo(() => collectStoryBlocks(splitCodeIntoSegments(stripStoryTabsMarkup(code))), [code]);
	const fields = useMemo(() => discoverFilterFields(blocks, queryData), [blocks, queryData]);
	const [filters, setFilters] = useState<ManualFilter[]>([]);

	const addFilter = useCallback((filter: ManualFilter) => setFilters((current) => [...current, filter]), []);

	const updateFilter = useCallback(
		(filter: ManualFilter) =>
			setFilters((current) => current.map((candidate) => (candidate.id === filter.id ? filter : candidate))),
		[],
	);

	const removeFilter = useCallback(
		(filterId: string) => setFilters((current) => current.filter((candidate) => candidate.id !== filterId)),
		[],
	);

	const clearFilters = useCallback(() => setFilters([]), []);

	const activeFilters = useMemo(() => filters.filter(isManualFilterActive), [filters]);
	const filteredQueryData = useMemo(() => applyManualFilters(queryData, activeFilters), [queryData, activeFilters]);

	return {
		blocks,
		fields,
		filters,
		activeFilters,
		hasActiveFilters: activeFilters.length > 0,
		queryData: filteredQueryData,
		addFilter,
		updateFilter,
		removeFilter,
		clearFilters,
	};
}
