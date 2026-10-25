import { useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';

import type { QueryDataMap } from '@/components/story-embeds';
import type { StoryRefreshHistoryValue } from '@/contexts/story-refresh-history';
import type { StoryRefreshHistoryFocus, StoryRefreshQueryResult, StoryRefreshRun } from '@/lib/story-refresh-history';
import { buildFixWithNaoPrompt, getLatestQueryFailures } from '@/lib/story-refresh-history';
import { buildMockStoryRefreshHistory } from '@/lib/story-refresh-history.mock';
import { chatInputRestoreStore } from '@/stores/chat-input-restore';

const STORY_QUERY_HIGHLIGHT_CLASSES = ['ring-2', 'ring-destructive/40', 'ring-offset-4', 'rounded-lg'];
const STORY_QUERY_HIGHLIGHT_MS = 2_500;

export function useStoryRefreshHistoryController({
	chatId,
	storySlug,
	code,
	queryData,
	scheduleDescription,
}: {
	chatId: string;
	storySlug: string;
	code: string;
	queryData: QueryDataMap | null;
	scheduleDescription?: string | null;
}): StoryRefreshHistoryValue {
	const navigate = useNavigate();
	const [isOpen, setIsOpen] = useState(false);
	const [focus, setFocus] = useState<StoryRefreshHistoryFocus | null>(null);

	const runs = useMemo(() => buildMockStoryRefreshHistory(code, queryData), [code, queryData]);
	const failuresByQueryId = useMemo(() => getLatestQueryFailures(runs), [runs]);

	const open = useCallback((nextFocus?: StoryRefreshHistoryFocus) => {
		setFocus(nextFocus ?? null);
		setIsOpen(true);
	}, []);
	const close = useCallback(() => setIsOpen(false), []);
	const toggle = useCallback(() => {
		setFocus(null);
		setIsOpen((current) => !current);
	}, []);

	const fixWithNao = useCallback(
		(run: StoryRefreshRun, query: StoryRefreshQueryResult) => {
			chatInputRestoreStore.set({
				text: buildFixWithNaoPrompt(run, query),
				images: [],
				documents: [],
				citation: {
					start: 0,
					end: 0,
					text: query.title,
					storySlug,
					block: { kind: query.blockKind, title: query.title, queryId: query.queryId },
				},
			});
			navigate({ to: '/$chatId', params: { chatId }, state: { openStorySlug: storySlug } });
		},
		[chatId, navigate, storySlug],
	);

	return useMemo(
		() => ({
			runs,
			failuresByQueryId,
			scheduleDescription,
			isOpen,
			focus,
			open,
			close,
			toggle,
			showInStory: highlightStoryQueryBlock,
			fixWithNao,
		}),
		[runs, failuresByQueryId, scheduleDescription, isOpen, focus, open, close, toggle, fixWithNao],
	);
}

function highlightStoryQueryBlock(queryId: string) {
	const element = document.querySelector<HTMLElement>(`[data-story-query-id="${CSS.escape(queryId)}"]`);
	if (!element) {
		return;
	}
	element.scrollIntoView({ behavior: 'smooth', block: 'center' });
	element.classList.add(...STORY_QUERY_HIGHLIGHT_CLASSES);
	window.setTimeout(() => element.classList.remove(...STORY_QUERY_HIGHLIGHT_CLASSES), STORY_QUERY_HIGHLIGHT_MS);
}
