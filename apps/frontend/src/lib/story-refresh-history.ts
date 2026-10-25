export type StoryRefreshTrigger = 'schedule' | 'manual' | 'chat';

export type StoryRefreshRunStatus = 'success' | 'partial' | 'failed';

export type StoryQueryBlockKind = 'chart' | 'table' | 'map';

export interface StoryRefreshQueryResult {
	queryId: string;
	title: string;
	blockKind: StoryQueryBlockKind;
	status: 'success' | 'failed';
	durationMs: number;
	rowCount?: number;
	sql: string;
	errorMessage?: string;
}

export interface StoryRefreshRun {
	id: string;
	startedAt: Date;
	durationMs: number;
	trigger: StoryRefreshTrigger;
	triggeredBy?: string;
	status: StoryRefreshRunStatus;
	queries: StoryRefreshQueryResult[];
}

export interface StoryQueryFailure {
	run: StoryRefreshRun;
	query: StoryRefreshQueryResult;
	lastSucceededAt: Date | null;
}

export interface StoryRefreshHistoryFocus {
	runId: string;
	queryId?: string;
}

export function countRunQueries(run: StoryRefreshRun) {
	const failed = run.queries.filter((query) => query.status === 'failed').length;
	return { refreshed: run.queries.length - failed, failed, total: run.queries.length };
}

/** Failures of the latest run, keyed by query id, with the date of each query's last good data. */
export function getLatestQueryFailures(runs: StoryRefreshRun[]): Map<string, StoryQueryFailure> {
	const [latestRun] = runs;
	const failures = new Map<string, StoryQueryFailure>();
	if (!latestRun || latestRun.status === 'success') {
		return failures;
	}

	for (const query of latestRun.queries) {
		if (query.status === 'failed') {
			failures.set(query.queryId, {
				run: latestRun,
				query,
				lastSucceededAt: findLastSuccessDate(runs, query.queryId),
			});
		}
	}
	return failures;
}

export function buildFixWithNaoPrompt(run: StoryRefreshRun, query: StoryRefreshQueryResult): string {
	return [
		`The ${TRIGGER_LABELS[run.trigger].toLowerCase()} refresh on ${run.startedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} failed for the ${query.blockKind} "${query.title}" (${query.queryId}).`,
		`Error: ${query.errorMessage ?? 'Unknown error'}`,
		`SQL that ran:\n${query.sql}`,
		'Please fix the query so this block refreshes again, and keep the rest of the story unchanged.',
	].join('\n\n');
}

export const TRIGGER_LABELS: Record<StoryRefreshTrigger, string> = {
	schedule: 'Scheduled',
	manual: 'Manual',
	chat: 'Chat',
};

export function formatRunDate(date: Date): string {
	const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	const dayDiff = getCalendarDayDiff(date, new Date());
	if (dayDiff === 0) {
		return `Today, ${time}`;
	}
	if (dayDiff === 1) {
		return `Yesterday, ${time}`;
	}
	return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
}

export function formatRunDuration(ms: number): string {
	if (ms < 1_000) {
		return `${ms}ms`;
	}
	if (ms < 60_000) {
		return `${(ms / 1_000).toFixed(1)}s`;
	}
	const minutes = Math.floor(ms / 60_000);
	const seconds = Math.round((ms % 60_000) / 1_000);
	return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

function findLastSuccessDate(runs: StoryRefreshRun[], queryId: string): Date | null {
	const run = runs.find((candidate) =>
		candidate.queries.some((query) => query.queryId === queryId && query.status === 'success'),
	);
	return run?.startedAt ?? null;
}

function getCalendarDayDiff(from: Date, to: Date): number {
	const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
	return Math.round((startOfDay(to) - startOfDay(from)) / 86_400_000);
}
