import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

import type { StoryRefreshQueryResult, StoryRefreshRun } from '@/lib/story-refresh-history';
import {
	buildMockRefreshHistory,
	extractStoryQueryBlocks,
	findLastSuccessfulRefresh,
} from '@/lib/story-refresh-history';

interface StoryRefreshHistoryValue {
	runs: StoryRefreshRun[];
	latestRun: StoryRefreshRun | null;
	selectedRun: StoryRefreshRun | null;
	isExpanded: boolean;
	timelineRef: RefObject<HTMLDivElement | null>;
	setIsExpanded: (expanded: boolean) => void;
	selectRun: (runId: string | null) => void;
	revealRun: (runId: string) => void;
	fixWithNao: (run: StoryRefreshRun, query: StoryRefreshQueryResult) => void;
}

export interface StoryRefreshBlockState {
	latestRun: StoryRefreshRun;
	latestResult: StoryRefreshQueryResult;
	selectedResult: StoryRefreshQueryResult | null;
	lastSuccessAt: Date | null;
	isHighlighted: boolean;
	isDimmed: boolean;
}

const StoryRefreshHistoryContext = createContext<StoryRefreshHistoryValue | null>(null);

export function StoryRefreshHistoryProvider({
	code,
	enabled,
	onFixWithNao,
	children,
}: {
	code: string;
	enabled: boolean;
	onFixWithNao: (run: StoryRefreshRun, query: StoryRefreshQueryResult) => void;
	children: ReactNode;
}) {
	const value = useStoryRefreshHistoryState(code, onFixWithNao);
	return (
		<StoryRefreshHistoryContext.Provider value={enabled ? value : null}>
			{children}
		</StoryRefreshHistoryContext.Provider>
	);
}

export function useStoryRefreshHistory(): StoryRefreshHistoryValue | null {
	return useContext(StoryRefreshHistoryContext);
}

export function useStoryRefreshBlockState(queryId: string): StoryRefreshBlockState | null {
	const history = useStoryRefreshHistory();
	if (!history?.latestRun) {
		return null;
	}

	const latestResult = findQueryResult(history.latestRun, queryId);
	if (!latestResult) {
		return null;
	}

	const selectedResult = history.selectedRun ? findQueryResult(history.selectedRun, queryId) : null;
	const selectedRunHasFailures = history.selectedRun?.status !== 'success';
	const isHighlighted = selectedResult?.status === 'failed';

	return {
		latestRun: history.latestRun,
		latestResult,
		selectedResult,
		lastSuccessAt: findLastSuccessfulRefresh(history.runs, queryId),
		isHighlighted,
		isDimmed: Boolean(history.selectedRun) && selectedRunHasFailures && !isHighlighted,
	};
}

function useStoryRefreshHistoryState(
	code: string,
	onFixWithNao: (run: StoryRefreshRun, query: StoryRefreshQueryResult) => void,
): StoryRefreshHistoryValue {
	const runs = useMemo(() => buildMockRefreshHistory(extractStoryQueryBlocks(code)), [code]);
	const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
	const [isExpanded, setIsExpanded] = useState(false);
	const timelineRef = useRef<HTMLDivElement | null>(null);

	const revealRun = useCallback((runId: string) => {
		setIsExpanded(true);
		setSelectedRunId(runId);
		timelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}, []);

	const handleExpandedChange = useCallback((expanded: boolean) => {
		setIsExpanded(expanded);
		if (!expanded) {
			setSelectedRunId(null);
		}
	}, []);

	return useMemo(
		() => ({
			runs,
			latestRun: runs[0] ?? null,
			selectedRun: runs.find((run) => run.id === selectedRunId) ?? null,
			isExpanded,
			timelineRef,
			setIsExpanded: handleExpandedChange,
			selectRun: setSelectedRunId,
			revealRun,
			fixWithNao: onFixWithNao,
		}),
		[runs, selectedRunId, isExpanded, handleExpandedChange, revealRun, onFixWithNao],
	);
}

function findQueryResult(run: StoryRefreshRun, queryId: string): StoryRefreshQueryResult | null {
	return run.queries.find((query) => query.queryId === queryId) ?? null;
}
