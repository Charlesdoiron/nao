import { splitCodeIntoSegments } from '@nao/shared/story-segments';
import { parseStoryTabs, stripStoryTabsMarkup } from '@nao/shared/story-tabs';
import type { Segment } from '@nao/shared/story-segments';

export type StoryRefreshTrigger = 'schedule' | 'manual' | 'chat';
export type StoryRefreshRunStatus = 'success' | 'partial' | 'failed';
export type StoryRefreshQueryStatus = 'success' | 'failed';
export type StoryQueryBlockKind = 'chart' | 'table' | 'map';

export interface StoryQueryBlock {
	queryId: string;
	title: string;
	kind: StoryQueryBlockKind;
	chartType?: string;
}

export interface StoryRefreshQueryOutcome extends StoryQueryBlock {
	status: StoryRefreshQueryStatus;
	durationMs: number;
	rowCount: number | null;
	sql: string;
	errorMessage?: string;
}

export interface StoryRefreshRun {
	id: string;
	startedAt: Date;
	durationMs: number;
	trigger: StoryRefreshTrigger;
	triggeredBy: string;
	status: StoryRefreshRunStatus;
	queries: StoryRefreshQueryOutcome[];
}

export interface StoryQueryRefreshFailure {
	run: StoryRefreshRun;
	query: StoryRefreshQueryOutcome;
	lastSucceededAt: Date | null;
}

export const REFRESH_TRIGGER_LABELS: Record<StoryRefreshTrigger, string> = {
	schedule: 'Schedule',
	manual: 'Manual',
	chat: 'Chat',
};

export const REFRESH_STATUS_LABELS: Record<StoryRefreshRunStatus, string> = {
	success: 'Succeeded',
	partial: 'Partially failed',
	failed: 'Failed',
};

export function getStoryQueryBlocks(code: string): StoryQueryBlock[] {
	const tabs = parseStoryTabs(code);
	const tabCodes = tabs?.length ? tabs.map((tab) => tab.innerCode) : [stripStoryTabsMarkup(code)];
	const blocks = tabCodes.flatMap((tabCode) => collectQueryBlocks(splitCodeIntoSegments(tabCode)));
	return dedupeByQueryId(blocks);
}

export function getLatestRunFailures(runs: StoryRefreshRun[]): Map<string, StoryQueryRefreshFailure> {
	const [latestRun, ...olderRuns] = runs;
	const failures = new Map<string, StoryQueryRefreshFailure>();
	if (!latestRun) {
		return failures;
	}

	for (const query of latestRun.queries) {
		if (query.status === 'failed') {
			const lastSuccess = olderRuns.find((run) =>
				run.queries.some((candidate) => candidate.queryId === query.queryId && candidate.status === 'success'),
			);
			failures.set(query.queryId, { run: latestRun, query, lastSucceededAt: lastSuccess?.startedAt ?? null });
		}
	}
	return failures;
}

export function countSucceededQueries(run: StoryRefreshRun): number {
	return run.queries.filter((query) => query.status === 'success').length;
}

export function getSharedErrorMessage(run: StoryRefreshRun): string | null {
	const messages = new Set(run.queries.map((query) => query.errorMessage));
	if (run.status !== 'failed' || messages.size !== 1) {
		return null;
	}
	return run.queries[0]?.errorMessage ?? null;
}

export function formatRefreshDuration(durationMs: number): string {
	if (durationMs < 1000) {
		return `${durationMs} ms`;
	}
	const seconds = durationMs / 1000;
	if (seconds < 60) {
		return `${seconds.toFixed(1)}s`;
	}
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.round(seconds % 60);
	return `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s`;
}

export function formatRefreshDate(date: Date, now = new Date()): string {
	const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
	const dayDifference = getCalendarDayDifference(date, now);
	if (dayDifference === 0) {
		return `Today, ${time}`;
	}
	if (dayDifference === 1) {
		return `Yesterday, ${time}`;
	}
	const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	return `${day}, ${time}`;
}

function collectQueryBlocks(segments: Segment[]): StoryQueryBlock[] {
	return segments.flatMap((segment): StoryQueryBlock[] => {
		switch (segment.type) {
			case 'chart':
				return [
					{
						queryId: segment.chart.queryId,
						title: segment.chart.title,
						kind: 'chart',
						chartType: segment.chart.chartType,
					},
				];
			case 'table':
				return [{ queryId: segment.table.queryId, title: segment.table.title, kind: 'table' }];
			case 'map':
				return [{ queryId: segment.map.queryId, title: segment.map.title, kind: 'map' }];
			case 'grid':
				return collectQueryBlocks(segment.children);
			default:
				return [];
		}
	});
}

function dedupeByQueryId(blocks: StoryQueryBlock[]): StoryQueryBlock[] {
	const seen = new Set<string>();
	return blocks.filter((block) => {
		if (seen.has(block.queryId)) {
			return false;
		}
		seen.add(block.queryId);
		return true;
	});
}

function getCalendarDayDifference(date: Date, now: Date): number {
	const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
	const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	return Math.round((startOfNow - startOfDate) / 86_400_000);
}
