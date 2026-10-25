import { splitCodeIntoSegments } from '@nao/shared/story-segments';
import type { Segment } from '@nao/shared/story-segments';

import type {
	StoryQueryBlockKind,
	StoryRefreshQueryResult,
	StoryRefreshRun,
	StoryRefreshTrigger,
} from '@/lib/story-refresh-history';
import type { QueryDataMap } from '@/components/story-embeds';

interface StoryQueryBlock {
	queryId: string;
	title: string;
	blockKind: StoryQueryBlockKind;
}

interface MockRunTemplate {
	daysAgo: number;
	hour: number;
	minute: number;
	trigger: StoryRefreshTrigger;
	triggeredBy?: string;
	failures: (blocks: StoryQueryBlock[]) => Map<string, string>;
}

const SCHEMA_ERROR =
	'Binder Error: Referenced column "plan_tier" not found in FROM clause! Candidate bindings: "subscriptions.plan"';
const TIMEOUT_ERROR = 'Query exceeded the 60s statement timeout and was cancelled.';
const WAREHOUSE_ERROR = 'Could not connect to the warehouse: connection to analytics.eu-west-1 timed out after 30s.';

const RUN_TEMPLATES: MockRunTemplate[] = [
	{ daysAgo: 0, hour: 8, minute: 0, trigger: 'schedule', failures: failPartially },
	{ daysAgo: 1, hour: 16, minute: 42, trigger: 'chat', triggeredBy: 'nao', failures: failNothing },
	{ daysAgo: 2, hour: 8, minute: 0, trigger: 'schedule', failures: failEverything },
	{ daysAgo: 3, hour: 11, minute: 15, trigger: 'manual', triggeredBy: 'Test', failures: failNothing },
	{ daysAgo: 3, hour: 8, minute: 0, trigger: 'schedule', failures: failNothing },
	{ daysAgo: 4, hour: 8, minute: 0, trigger: 'schedule', failures: failNothing },
	{ daysAgo: 5, hour: 8, minute: 0, trigger: 'schedule', failures: failNothing },
];

const DEMO_SQL: Record<string, string> = {
	query_revenue_monthly: `SELECT
  date_trunc('month', paid_at) AS month,
  SUM(amount) AS revenue
FROM invoices
WHERE status = 'paid'
GROUP BY 1
ORDER BY 1`,
	query_orders_by_channel: `SELECT
  acquisition_channel AS channel,
  COUNT(*) AS orders
FROM orders
WHERE created_at >= current_date - INTERVAL 30 DAY
GROUP BY 1
ORDER BY orders DESC`,
	query_churn_by_plan: `SELECT
  s.plan_tier AS plan,
  ROUND(100.0 * COUNT(*) FILTER (WHERE s.churned_at IS NOT NULL) / COUNT(*), 1) AS churn_rate
FROM subscriptions s
GROUP BY 1
ORDER BY churn_rate DESC`,
	query_signups_weekly: `SELECT
  date_trunc('week', created_at) AS week,
  COUNT(*) AS signups
FROM users
GROUP BY 1
ORDER BY 1`,
	query_top_accounts: `SELECT
  a.name AS account,
  s.plan,
  SUM(i.amount) * 12 AS arr,
  COUNT(DISTINCT u.id) AS seats
FROM accounts a
JOIN subscriptions s ON s.account_id = a.id
JOIN invoices i ON i.account_id = a.id
JOIN users u ON u.account_id = a.id
GROUP BY 1, 2
ORDER BY arr DESC
LIMIT 10`,
};

export function buildMockStoryRefreshHistory(code: string, queryData: QueryDataMap | null): StoryRefreshRun[] {
	const blocks = listStoryQueryBlocks(code);
	if (blocks.length === 0) {
		return [];
	}

	return RUN_TEMPLATES.map((template, runIndex) => buildRun(template, runIndex, blocks, queryData));
}

function buildRun(
	template: MockRunTemplate,
	runIndex: number,
	blocks: StoryQueryBlock[],
	queryData: QueryDataMap | null,
): StoryRefreshRun {
	const failures = template.failures(blocks);
	const queries = blocks.map((block, blockIndex): StoryRefreshQueryResult => {
		const errorMessage = failures.get(block.queryId);
		return {
			...block,
			status: errorMessage ? 'failed' : 'success',
			durationMs: getMockQueryDuration(errorMessage, runIndex, blockIndex),
			rowCount: errorMessage ? undefined : (queryData?.[block.queryId]?.data.length ?? 12 + blockIndex * 7),
			sql: DEMO_SQL[block.queryId] ?? buildFallbackSql(block),
			errorMessage,
		};
	});
	const failedCount = queries.filter((query) => query.status === 'failed').length;

	return {
		id: `run-${runIndex}`,
		startedAt: getRunDate(template),
		durationMs: Math.max(...queries.map((query) => query.durationMs)) + 420,
		trigger: template.trigger,
		triggeredBy: template.triggeredBy,
		status: failedCount === 0 ? 'success' : failedCount === queries.length ? 'failed' : 'partial',
		queries,
	};
}

function listStoryQueryBlocks(code: string): StoryQueryBlock[] {
	return splitCodeIntoSegments(code).flatMap(toQueryBlocks);
}

function toQueryBlocks(segment: Segment): StoryQueryBlock[] {
	switch (segment.type) {
		case 'chart':
			return [
				{ queryId: segment.chart.queryId, title: segment.chart.title || 'Untitled chart', blockKind: 'chart' },
			];
		case 'table':
			return [
				{ queryId: segment.table.queryId, title: segment.table.title || 'Untitled table', blockKind: 'table' },
			];
		case 'map':
			return [{ queryId: segment.map.queryId, title: segment.map.title || 'Untitled map', blockKind: 'map' }];
		case 'grid':
			return segment.children.flatMap(toQueryBlocks);
		default:
			return [];
	}
}

function failPartially(blocks: StoryQueryBlock[]): Map<string, string> {
	const failures = new Map<string, string>();
	const schemaFailure = blocks[Math.min(2, blocks.length - 1)];
	failures.set(schemaFailure.queryId, SCHEMA_ERROR);
	const lastBlock = blocks[blocks.length - 1];
	if (blocks.length >= 4 && !failures.has(lastBlock.queryId)) {
		failures.set(lastBlock.queryId, TIMEOUT_ERROR);
	}
	return failures;
}

function failNothing(): Map<string, string> {
	return new Map();
}

function failEverything(blocks: StoryQueryBlock[]): Map<string, string> {
	return new Map(blocks.map((block) => [block.queryId, WAREHOUSE_ERROR]));
}

function getMockQueryDuration(errorMessage: string | undefined, runIndex: number, blockIndex: number): number {
	if (errorMessage === TIMEOUT_ERROR) {
		return 60_000;
	}
	if (errorMessage === WAREHOUSE_ERROR) {
		return 30_000;
	}
	if (errorMessage) {
		return 180 + blockIndex * 20;
	}
	return 640 + ((runIndex * 7 + blockIndex * 13) % 9) * 410;
}

function getRunDate({ daysAgo, hour, minute }: MockRunTemplate): Date {
	const date = new Date();
	date.setDate(date.getDate() - daysAgo);
	date.setHours(hour, minute, 0, 0);
	if (date.getTime() > Date.now()) {
		date.setDate(date.getDate() - 1);
	}
	return date;
}

function buildFallbackSql(block: StoryQueryBlock): string {
	return `-- ${block.title}\nSELECT *\nFROM analytics.${block.queryId.replace(/^query_/, '')}\nLIMIT 1000`;
}
