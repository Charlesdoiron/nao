import { useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

import { useDebouncedValue } from '@/hooks/use-debounced-value';

export const FILTER_OPTIONS_PAGE_SIZE = 50;

const SEARCH_DEBOUNCE_MS = 200;
const MOCK_LATENCY_MS = 450;

interface FilterOptionsPage {
	options: string[];
	total: number;
	nextCursor: number | null;
}

/**
 * Prototype: emulates a server-side `{ search, cursor, limit }` options endpoint over the full option list,
 * so the picker can be evaluated with progressive loading before the backend supports paging.
 */
export function usePagedFilterOptions({
	filterId,
	sourceOptions,
	search,
	enabled,
}: {
	filterId: string;
	sourceOptions: string[];
	search: string;
	enabled: boolean;
}) {
	const normalizedSearch = search.trim();
	const debouncedSearch = useDebouncedValue(normalizedSearch, SEARCH_DEBOUNCE_MS);

	const query = useInfiniteQuery({
		queryKey: ['story-filter-options-page', filterId, sourceOptions, debouncedSearch],
		queryFn: ({ pageParam }) => fetchMockOptionsPage(sourceOptions, debouncedSearch, pageParam),
		initialPageParam: 0,
		getNextPageParam: (lastPage) => lastPage.nextCursor,
		placeholderData: keepPreviousData,
		staleTime: Infinity,
		enabled,
	});

	const options = useMemo(() => query.data?.pages.flatMap((page) => page.options) ?? [], [query.data]);

	return {
		options,
		total: query.data?.pages[0]?.total ?? 0,
		search: debouncedSearch,
		hasMore: query.hasNextPage,
		loadMore: query.fetchNextPage,
		isLoadingFirstPage: query.isPending,
		isLoadingMore: query.isFetchingNextPage,
		isSearching: normalizedSearch !== debouncedSearch || (query.isPlaceholderData && query.isFetching),
	};
}

async function fetchMockOptionsPage(
	sourceOptions: string[],
	search: string,
	cursor: number,
): Promise<FilterOptionsPage> {
	await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
	const matches = search ? sourceOptions.filter((option) => matchesSearch(option, search)) : sourceOptions;
	const nextCursor = cursor + FILTER_OPTIONS_PAGE_SIZE;
	return {
		options: matches.slice(cursor, nextCursor),
		total: matches.length,
		nextCursor: nextCursor < matches.length ? nextCursor : null,
	};
}

function matchesSearch(option: string, search: string): boolean {
	return option.toLowerCase().includes(search.toLowerCase());
}
