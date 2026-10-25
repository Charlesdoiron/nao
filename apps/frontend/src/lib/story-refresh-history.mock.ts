import type {
	StoryQueryBlock,
	StoryRefreshQueryOutcome,
	StoryRefreshRun,
	StoryRefreshRunStatus,
	StoryRefreshTrigger,
} from '@/lib/story-refresh-history';

interface MockRunSpec {
	daysAgo: number;
	hour: number;
	minute: number;
	trigger: StoryRefreshTrigger;
	failure?: 'latest-chart' | 'last-block' | 'warehouse';
}

interface MockRefreshHistoryInput {
	blocks: StoryQueryBlock[];
	columnsByQueryId: Record<string, string[]>;
	rowCountByQueryId: Record<string, number>;
	latestAt: Date;
	ownerName: string;
	scheduleDescription: string | null;
}

const MOCK_RUN_SPECS: MockRunSpec[] = [
	{ daysAgo: 0, hour: 9, minute: 0, trigger: 'schedule', failure: 'latest-chart' },
	{ daysAgo: 1, hour: 15, minute: 42, trigger: 'manual' },
	{ daysAgo: 1, hour: 9, minute: 0, trigger: 'schedule' },
	{ daysAgo: 2, hour: 11, minute: 18, trigger: 'chat' },
	{ daysAgo: 2, hour: 9, minute: 0, trigger: 'schedule', failure: 'warehouse' },
	{ daysAgo: 3, hour: 9, minute: 0, trigger: 'schedule' },
	{ daysAgo: 4, hour: 9, minute: 0, trigger: 'schedule' },
	{ daysAgo: 5, hour: 9, minute: 0, trigger: 'schedule', failure: 'last-block' },
	{ daysAgo: 6, hour: 9, minute: 0, trigger: 'schedule' },
	{ daysAgo: 7, hour: 17, minute: 5, trigger: 'manual' },
	{ daysAgo: 7, hour: 9, minute: 0, trigger: 'schedule' },
	{ daysAgo: 8, hour: 9, minute: 0, trigger: 'schedule' },
	{ daysAgo: 9, hour: 14, minute: 31, trigger: 'chat' },
	{ daysAgo: 9, hour: 9, minute: 0, trigger: 'schedule' },
];

const WAREHOUSE_ERROR =
	'Connection error: timed out after 30s while connecting to warehouse "analytics" (host: warehouse.internal:5432). The server may be down or unreachable.';

const STATEMENT_TIMEOUT_ERROR =
	'Query exceeded the 60s statement timeout and was cancelled. Consider adding a date filter or pre-aggregating the source table.';

export function buildMockStoryRefreshHistory(input: MockRefreshHistoryInput): StoryRefreshRun[] {
	if (input.blocks.length === 0) {
		return [];
	}
	return MOCK_RUN_SPECS.map((spec, runIndex) => buildRun(spec, runIndex, input));
}

function buildRun(spec: MockRunSpec, runIndex: number, input: MockRefreshHistoryInput): StoryRefreshRun {
	const failingQueryIds = getFailingQueryIds(spec, input.blocks);
	const queries = input.blocks.map((block, queryIndex) =>
		buildQueryOutcome(block, {
			durationMs: getMockQueryDuration(spec, runIndex, queryIndex, failingQueryIds.has(block.queryId)),
			isFailing: failingQueryIds.has(block.queryId),
			errorMessage: getErrorMessage(spec, block),
			columns: input.columnsByQueryId[block.queryId] ?? [],
			rowCount: input.rowCountByQueryId[block.queryId] ?? 0,
		}),
	);
	const startedAt = new Date(input.latestAt);
	startedAt.setDate(startedAt.getDate() - spec.daysAgo);
	startedAt.setHours(spec.hour, spec.minute, 0, 0);

	return {
		id: `run_${String(MOCK_RUN_SPECS.length - runIndex).padStart(3, '0')}`,
		startedAt,
		durationMs: Math.max(...queries.map((query) => query.durationMs)) + 420,
		trigger: spec.trigger,
		triggeredBy: getTriggeredBy(spec.trigger, input),
		status: getRunStatus(queries),
		queries,
	};
}

function buildQueryOutcome(
	block: StoryQueryBlock,
	options: { durationMs: number; isFailing: boolean; errorMessage: string; columns: string[]; rowCount: number },
): StoryRefreshQueryOutcome {
	const sql = buildMockSql(block, options.columns);
	if (options.isFailing) {
		return {
			...block,
			status: 'failed',
			durationMs: options.durationMs,
			rowCount: null,
			sql,
			errorMessage: options.errorMessage,
		};
	}
	return { ...block, status: 'success', durationMs: options.durationMs, rowCount: options.rowCount, sql };
}

function getFailingQueryIds(spec: MockRunSpec, blocks: StoryQueryBlock[]): Set<string> {
	switch (spec.failure) {
		case 'warehouse':
			return new Set(blocks.map((block) => block.queryId));
		case 'latest-chart': {
			const charts = blocks.filter((block) => block.kind === 'chart' && block.chartType !== 'kpi_card');
			return new Set([(charts.at(-1) ?? blocks.at(-1))!.queryId]);
		}
		case 'last-block':
			return new Set([blocks.at(-1)!.queryId]);
		default:
			return new Set();
	}
}

function getErrorMessage(spec: MockRunSpec, block: StoryQueryBlock): string {
	if (spec.failure === 'warehouse') {
		return WAREHOUSE_ERROR;
	}
	if (spec.failure === 'last-block') {
		return STATEMENT_TIMEOUT_ERROR;
	}
	const table = getMockTableName(block.queryId);
	return `Catalog Error: Table with name ${table} does not exist!\nDid you mean "analytics.${table}_v2"?\n\nLINE 4: FROM analytics.${table}\n             ^`;
}

function getRunStatus(queries: StoryRefreshQueryOutcome[]): StoryRefreshRunStatus {
	const failedCount = queries.filter((query) => query.status === 'failed').length;
	if (failedCount === 0) {
		return 'success';
	}
	return failedCount === queries.length ? 'failed' : 'partial';
}

function getTriggeredBy(trigger: StoryRefreshTrigger, input: MockRefreshHistoryInput): string {
	switch (trigger) {
		case 'schedule':
			return input.scheduleDescription ?? 'Story schedule';
		case 'manual':
			return input.ownerName;
		case 'chat':
			return `nao, in chat with ${input.ownerName}`;
	}
}

function buildMockSql(block: StoryQueryBlock, columns: string[]): string {
	const table = `analytics.${getMockTableName(block.queryId)}`;
	const [dimension, ...measures] = columns.length > 0 ? columns : ['value'];
	if (measures.length === 0) {
		return `SELECT\n  SUM(${dimension}) AS ${dimension}\nFROM ${table}\nWHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
	}
	const selections = [dimension, ...measures.map((measure) => `SUM(${measure}) AS ${measure}`)];
	return `SELECT\n  ${selections.join(',\n  ')}\nFROM ${table}\nWHERE created_at >= CURRENT_DATE - INTERVAL 6 MONTH\nGROUP BY 1\nORDER BY 1`;
}

function getMockTableName(queryId: string): string {
	return queryId.replace(/^q_/, '').replace(/[^a-zA-Z0-9_]/g, '_');
}

function getMockQueryDuration(spec: MockRunSpec, runIndex: number, queryIndex: number, isFailing: boolean): number {
	if (isFailing && spec.failure === 'warehouse') {
		return 30_000 + queryIndex * 14;
	}
	if (isFailing && spec.failure === 'last-block') {
		return 60_000;
	}
	return 380 + ((runIndex * 7 + queryIndex * 13) % 17) * 210;
}
