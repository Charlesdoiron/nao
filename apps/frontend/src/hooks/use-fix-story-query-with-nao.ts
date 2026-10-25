import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

import type { StoryRefreshQueryOutcome, StoryRefreshRun } from '@/lib/story-refresh-history';
import { formatRefreshDate, REFRESH_TRIGGER_LABELS } from '@/lib/story-refresh-history';
import { chatInputRestoreStore } from '@/stores/chat-input-restore';

export function useFixStoryQueryWithNao({ chatId, storySlug }: { chatId: string; storySlug: string }) {
	const navigate = useNavigate();

	return useCallback(
		(run: StoryRefreshRun, query: StoryRefreshQueryOutcome) => {
			chatInputRestoreStore.set({
				text: buildFixPrompt(run, query),
				images: [],
				documents: [],
				citation: {
					storySlug,
					start: 0,
					end: 0,
					text: query.title || query.queryId,
					block: { kind: query.kind, title: query.title, queryId: query.queryId },
				},
			});
			navigate({ to: '/$chatId', params: { chatId }, state: { openStorySlug: storySlug } });
		},
		[navigate, chatId, storySlug],
	);
}

function buildFixPrompt(run: StoryRefreshRun, query: StoryRefreshQueryOutcome): string {
	const blockName = query.title ? `"${query.title}" ${query.kind}` : `${query.kind} for ${query.queryId}`;
	const trigger = REFRESH_TRIGGER_LABELS[run.trigger].toLowerCase();
	return [
		`The ${blockName} in this story failed to refresh (${trigger} refresh, ${formatRefreshDate(run.startedAt)}). Fix its query so the chart refreshes again.`,
		`Error:\n${query.errorMessage ?? 'Unknown error'}`,
		`SQL that ran:\n${query.sql}`,
	].join('\n\n');
}
