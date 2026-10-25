import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';

export type StoryPageView = 'story' | 'refresh-history';

export interface StoryPageSearch {
	view?: 'refresh-history';
	run?: string;
	query?: string;
}

export function validateStoryPageSearch(search: Record<string, unknown>): StoryPageSearch {
	return {
		view: search.view === 'refresh-history' ? 'refresh-history' : undefined,
		run: typeof search.run === 'string' ? search.run : undefined,
		query: typeof search.query === 'string' ? search.query : undefined,
	};
}

export function useStoryPageView() {
	const search = useSearch({ from: '/_sidebar-layout/stories/$storyId' });
	const navigate = useNavigate({ from: '/stories/$storyId' });

	const showStory = useCallback(
		(queryId?: string) => {
			navigate({ search: { query: queryId }, replace: true });
		},
		[navigate],
	);

	const showRefreshHistory = useCallback(
		(selection: { runId?: string; queryId?: string } = {}) => {
			navigate({
				search: { view: 'refresh-history', run: selection.runId, query: selection.queryId },
				replace: true,
			});
		},
		[navigate],
	);

	return {
		view: (search.view ?? 'story') as StoryPageView,
		selectedRunId: search.run,
		selectedQueryId: search.query,
		showStory,
		showRefreshHistory,
	};
}
