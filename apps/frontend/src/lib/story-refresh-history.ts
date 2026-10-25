import { splitCodeIntoSegments } from '@nao/shared/story-segments';
import { stripStoryTabsMarkup } from '@nao/shared/story-tabs';
import type { Segment } from '@nao/shared/story-segments';

export type StoryRefreshTrigger = 'schedule' | 'manual' | 'chat';
export type StoryRefreshRunStatus = 'success' | 'partial' | 'failed';
export type StoryRefreshQueryStatus = 'success' | 'failed';

export interface StoryQueryBlock {
	queryId: string;
	title: string;
	kind: 'chart' | 'table' | 'map';
}

export interface StoryRefreshQueryResult extends StoryQueryBlock {
	status: StoryRefreshQueryStatus;
	durationMs: number;
	rowCount?: number;
	errorMessage?: string;
}

export interface StoryRefreshRun {
	id: string;
	startedAt: Date;
	trigger: StoryRefreshTrigger;
	triggeredBy?: string;
	status: StoryRefreshRunStatus;
	durationMs: number;
	queries: StoryRefreshQueryResult[];
}

export const REFRESH_TRIGGER_LABELS: Record<StoryRefreshTrigger, string> = {
	schedule: 'Scheduled',
	manual: 'Manual',
	chat: 'From chat',
};

export function extractStoryQueryBlocks(code: string): StoryQueryBlock[] {
	const blocks = new Map<string, StoryQueryBlock>();
	collectQueryBlocks(splitCodeIntoSegments(stripStoryTabsMarkup(code)), blocks);
	return [...blocks.values()];
}

export function getFailedQueries(run: StoryRefreshRun): StoryRefreshQueryResult[] {
	return run.queries.filter((query) => query.status === 'failed');
}

export function countRefreshedQueries(run: StoryRefreshRun): number {
	return run.queries.length - getFailedQueries(run).length;
}

export function findLastSuccessfulRefresh(runs: StoryRefreshRun[], queryId: string): Date | null {
	const run = runs.find((candidate) =>
		candidate.queries.some((query) => query.queryId === queryId && query.status === 'success'),
	);
	return run?.startedAt ?? null;
}

export function getStoryBlockAnchorId(queryId: string): string {
	return `story-refresh-block-${queryId}`;
}

export function scrollToStoryBlock(queryId: string) {
	document.getElementById(getStoryBlockAnchorId(queryId))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function formatRefreshDuration(durationMs: number): string {
	if (durationMs < 1000) {
		return `${durationMs} ms`;
	}
	return `${(durationMs / 1000).toFixed(1)} s`;
}

export function formatRefreshDate(date: Date): string {
	return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function buildFixWithNaoPrompt(run: StoryRefreshRun, query: StoryRefreshQueryResult): string {
	return [
		`The refresh of this story on ${formatRefreshDate(run.startedAt)} (${REFRESH_TRIGGER_LABELS[run.trigger].toLowerCase()}) failed for "${query.title}" (${query.queryId}).`,
		'',
		`Error: ${query.errorMessage ?? 'Unknown error'}`,
		'',
		'Can you fix the query so this chart refreshes again, keeping the same columns?',
	].join('\n');
}

/** Prototype-only history until refresh runs are persisted per query. */
export function buildMockRefreshHistory(blocks: StoryQueryBlock[], now = Date.now()): StoryRefreshRun[] {
	const failingIndexes = pickFailingIndexes(blocks.length);
	return MOCK_RUNS.map((template) => {
		const queries = blocks.map((block, index) => buildMockQueryResult(block, index, template, failingIndexes));
		return {
			id: template.id,
			startedAt: new Date(now - template.minutesAgo * 60_000),
			trigger: template.trigger,
			triggeredBy: template.triggeredBy,
			status: resolveRunStatus(queries),
			durationMs: queries.reduce((total, query) => total + query.durationMs, 0),
			queries,
		};
	});
}

interface MockRunTemplate {
	id: string;
	minutesAgo: number;
	trigger: StoryRefreshTrigger;
	triggeredBy?: string;
	failures: 'none' | 'all' | 'first' | 'both';
	allFailedMessage?: string;
}

const MOCK_RUNS: MockRunTemplate[] = [
	{ id: 'run-1', minutesAgo: 14, trigger: 'schedule', failures: 'both' },
	{ id: 'run-2', minutesAgo: 26 * 60, trigger: 'manual', triggeredBy: 'Test', failures: 'first' },
	{ id: 'run-3', minutesAgo: 3 * 24 * 60, trigger: 'chat', triggeredBy: 'Test', failures: 'none' },
	{ id: 'run-4', minutesAgo: 7 * 24 * 60, trigger: 'schedule', failures: 'none' },
	{
		id: 'run-5',
		minutesAgo: 14 * 24 * 60,
		trigger: 'schedule',
		failures: 'all',
		allFailedMessage: 'Connection timed out after 30s while connecting to warehouse "analytics-prod".',
	},
	{ id: 'run-6', minutesAgo: 21 * 24 * 60, trigger: 'schedule', failures: 'none' },
];

const MOCK_QUERY_ERRORS = [
	'Binder Error: Referenced column "region_name" not found in FROM clause! Candidate bindings: "r.name", "r.region_code".',
	'Permission denied: role "nao_reader" has no SELECT privilege on table analytics.fct_customer_activity.',
];

function collectQueryBlocks(segments: Segment[], blocks: Map<string, StoryQueryBlock>) {
	for (const segment of segments) {
		if (segment.type === 'grid') {
			collectQueryBlocks(segment.children, blocks);
		} else if (segment.type === 'chart') {
			addBlock(blocks, segment.chart.queryId, segment.chart.title || segment.chart.series[0]?.label, 'chart');
		} else if (segment.type === 'table') {
			addBlock(blocks, segment.table.queryId, segment.table.title, 'table');
		} else if (segment.type === 'map') {
			addBlock(blocks, segment.map.queryId, segment.map.title, 'map');
		}
	}
}

function addBlock(
	blocks: Map<string, StoryQueryBlock>,
	queryId: string,
	title: string | undefined,
	kind: StoryQueryBlock['kind'],
) {
	if (!blocks.has(queryId)) {
		blocks.set(queryId, { queryId, title: title || queryId, kind });
	}
}

function pickFailingIndexes(blockCount: number): [number, number] {
	if (blockCount <= 1) {
		return [0, 0];
	}
	const first = Math.min(2, blockCount - 1);
	const second = first + 1 < blockCount ? first + 1 : first - 1;
	return [first, second];
}

function buildMockQueryResult(
	block: StoryQueryBlock,
	index: number,
	template: MockRunTemplate,
	[firstFailing, secondFailing]: [number, number],
): StoryRefreshQueryResult {
	const durationMs = 420 + ((index * 731 + template.minutesAgo) % 1900);
	if (template.failures === 'all') {
		return { ...block, status: 'failed', durationMs: 6_000, errorMessage: template.allFailedMessage };
	}
	if (index === firstFailing && (template.failures === 'first' || template.failures === 'both')) {
		return { ...block, status: 'failed', durationMs, errorMessage: MOCK_QUERY_ERRORS[0] };
	}
	if (index === secondFailing && template.failures === 'both') {
		return { ...block, status: 'failed', durationMs, errorMessage: MOCK_QUERY_ERRORS[1] };
	}
	return { ...block, status: 'success', durationMs, rowCount: 1 + ((index * 17 + 3) % 40) };
}

function resolveRunStatus(queries: StoryRefreshQueryResult[]): StoryRefreshRunStatus {
	const failedCount = queries.filter((query) => query.status === 'failed').length;
	if (failedCount === 0) {
		return 'success';
	}
	return failedCount === queries.length ? 'failed' : 'partial';
}
