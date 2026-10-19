import type { GitRef, SuiteTest, TargetResult } from './test-suite-types';

export const PRODUCTION_REF_ID = 'main';
export const CURRENT_USER = 'Léa Martin';
export const COST_PER_RUN_USD = 0.04;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = Date.now();

export const GIT_REFS: GitRef[] = [
	{
		id: 'main',
		kind: 'branch',
		name: 'main',
		isProduction: true,
		commit: '8f3c2a1',
		pushedBy: [],
		updatedAt: now - 2 * DAY,
		commitsAhead: 0,
		changedContextFiles: [],
		affectedPrefixes: [],
	},
	{
		id: 'feature/arr-definitions',
		kind: 'branch',
		name: 'feature/arr-definitions',
		commit: 'c41d9e7',
		pushedBy: ['Léa Martin', 'Marc Dubois'],
		updatedAt: now - 3 * HOUR,
		commitsAhead: 4,
		changedContextFiles: ['semantics/revenue.md', 'metrics/arr.yml', 'rules/finance.md'],
		affectedPrefixes: ['revenue/', 'finance/'],
	},
	{
		id: 'fix/churn-cohorts',
		kind: 'branch',
		name: 'fix/churn-cohorts',
		commit: '2b7e0f4',
		pushedBy: ['Tom Becker'],
		updatedAt: now - 1 * DAY,
		commitsAhead: 2,
		changedContextFiles: ['semantics/customers.md'],
		affectedPrefixes: ['churn/'],
	},
	{
		id: 'v2.4.0',
		kind: 'tag',
		name: 'v2.4.0',
		commit: 'a90b3c2',
		pushedBy: ['Priya Shah'],
		updatedAt: now - 9 * DAY,
		commitsAhead: 0,
		changedContextFiles: [],
		affectedPrefixes: [],
	},
	{
		id: 'v2.3.1',
		kind: 'tag',
		name: 'v2.3.1',
		commit: '5e12d88',
		pushedBy: ['Priya Shah'],
		updatedAt: now - 24 * DAY,
		commitsAhead: 0,
		changedContextFiles: [],
		affectedPrefixes: [],
	},
];

export const OWNERS = ['Léa Martin', 'Tom Becker', 'Priya Shah', 'Marc Dubois', 'Sofia Rossi'];

export const FAILURE_REASONS = [
	'Value mismatch on arr_usd: got 4.38M, expected 4.21M',
	'Row count mismatch: got 11 rows, expected 12',
	'Agent queried deprecated table finance.revenue_v1',
	'Missing column: expected churned_accounts',
	'Timed out after 120s without a final answer',
];

export const INITIAL_TESTS: SuiteTest[] = [
	buildTest({
		name: 'revenue/arr_current',
		prompt: 'What is our current ARR?',
		sql: "SELECT SUM(arr_usd) AS arr_usd\nFROM analytics.subscriptions\nWHERE status = 'active'",
		tags: ['revenue', 'smoke'],
		owner: 'Léa Martin',
		history: { main: 'ppp', 'feature/arr-definitions': 'pff', 'v2.4.0': 'ppp' },
	}),
	buildTest({
		name: 'revenue/mrr_by_month',
		prompt: 'Show monthly recurring revenue for each month of 2026',
		sql: "SELECT DATE_TRUNC('month', invoice_date) AS month, SUM(mrr_usd) AS mrr\nFROM analytics.invoices\nWHERE invoice_date >= '2026-01-01'\nGROUP BY 1\nORDER BY 1",
		tags: ['revenue'],
		owner: 'Léa Martin',
		history: { main: 'ppf', 'feature/arr-definitions': 'ppp' },
	}),
	buildTest({
		name: 'revenue/net_revenue_retention',
		prompt: 'What was our net revenue retention last quarter?',
		sql: 'SELECT nrr FROM analytics.quarterly_retention\nORDER BY quarter DESC\nLIMIT 1',
		tags: ['revenue', 'board'],
		owner: 'Marc Dubois',
		history: { main: 'ppp', 'feature/arr-definitions': 'fff' },
	}),
	buildTest({
		name: 'revenue/arr_by_segment',
		prompt: 'Break down ARR by customer segment (SMB, mid-market, enterprise)',
		sql: "SELECT segment, SUM(arr_usd) AS arr_usd\nFROM analytics.subscriptions\nWHERE status = 'active'\nGROUP BY 1",
		tags: ['revenue'],
		owner: 'Léa Martin',
		addedOnRef: 'feature/arr-definitions',
		history: { 'feature/arr-definitions': 'ppp' },
	}),
	buildTest({
		name: 'finance/gross_margin',
		prompt: 'What is our gross margin this year?',
		sql: 'SELECT (revenue - cogs) / revenue AS gross_margin\nFROM finance.pnl_ytd',
		tags: ['finance', 'board'],
		owner: 'Marc Dubois',
		history: { main: 'ppp', 'feature/arr-definitions': 'ppp' },
	}),
	buildTest({
		name: 'finance/opex_by_department',
		prompt: 'How much did each department spend on opex last month?',
		sql: "SELECT department, SUM(amount_usd) AS opex\nFROM finance.expenses\nWHERE month = DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'\nGROUP BY 1",
		tags: ['finance'],
		owner: 'Sofia Rossi',
		history: { main: 'pfp' },
	}),
	buildTest({
		name: 'churn/monthly_churn_rate',
		prompt: 'What is the monthly logo churn rate over the last 6 months?',
		sql: 'SELECT month, churned / starting_accounts AS churn_rate\nFROM analytics.monthly_churn\nORDER BY month DESC\nLIMIT 6',
		tags: ['churn', 'smoke'],
		owner: 'Tom Becker',
		history: { main: 'ppp', 'feature/arr-definitions': 'ppp', 'fix/churn-cohorts': 'ppp' },
	}),
	buildTest({
		name: 'churn/churned_accounts_q3',
		prompt: 'List the enterprise accounts that churned in Q3',
		sql: "SELECT account_name, churn_date\nFROM analytics.accounts\nWHERE segment = 'enterprise' AND churn_date BETWEEN '2026-07-01' AND '2026-09-30'",
		tags: ['churn'],
		owner: 'Tom Becker',
		history: { main: 'fpf', 'feature/arr-definitions': 'fpf', 'fix/churn-cohorts': 'ppp' },
	}),
	buildTest({
		name: 'marketing/cac_by_channel',
		prompt: 'What is our customer acquisition cost by channel this quarter?',
		sql: 'SELECT channel, spend_usd / new_customers AS cac\nFROM marketing.channel_performance\nWHERE quarter = CURRENT_QUARTER',
		tags: ['marketing'],
		owner: 'Priya Shah',
		history: { main: 'ppp', 'feature/arr-definitions': 'ppf' },
	}),
	buildTest({
		name: 'marketing/signups_last_30d',
		prompt: 'How many signups did we get in the last 30 days?',
		sql: "SELECT COUNT(*) AS signups\nFROM product.users\nWHERE created_at >= CURRENT_DATE - INTERVAL '30 days'",
		tags: ['marketing', 'smoke'],
		owner: 'Priya Shah',
		history: { main: 'ppp', 'feature/arr-definitions': 'ppp' },
	}),
	buildTest({
		name: 'product/weekly_active_users',
		prompt: 'Plot weekly active users for the last 12 weeks',
		sql: "SELECT DATE_TRUNC('week', event_date) AS week, COUNT(DISTINCT user_id) AS wau\nFROM product.events\nGROUP BY 1\nORDER BY 1 DESC\nLIMIT 12",
		tags: ['product'],
		owner: 'Sofia Rossi',
		history: { main: 'ppp', 'feature/arr-definitions': 'ppp' },
	}),
	buildTest({
		name: 'product/feature_adoption',
		prompt: 'Which share of active accounts used dashboards last month?',
		sql: "SELECT COUNT(DISTINCT account_id) FILTER (WHERE feature = 'dashboards') / COUNT(DISTINCT account_id)\nFROM product.feature_usage",
		tags: ['product'],
		owner: 'Sofia Rossi',
		history: { main: 'pff' },
	}),
	buildTest({
		name: 'sales/pipeline_by_stage',
		prompt: 'Show open pipeline value by stage',
		sql: 'SELECT stage, SUM(amount_usd) AS pipeline\nFROM sales.opportunities\nWHERE is_closed = FALSE\nGROUP BY 1',
		tags: ['sales'],
		owner: 'Marc Dubois',
		history: { main: 'ppp', 'feature/arr-definitions': 'ppp' },
	}),
	buildTest({
		name: 'sales/win_rate_by_rep',
		prompt: 'What is the win rate per sales rep this year?',
		sql: "SELECT owner_name, AVG(CASE WHEN is_won THEN 1 ELSE 0 END) AS win_rate\nFROM sales.opportunities\nWHERE is_closed AND close_date >= DATE_TRUNC('year', CURRENT_DATE)\nGROUP BY 1",
		tags: ['sales'],
		owner: 'Marc Dubois',
		history: {},
	}),
];

/**
 * Hidden "true" pass probability per test and ref, used by the mocked runner so
 * re-running a test on a branch stays consistent with its recorded history.
 */
export function getMockPassProbability(test: SuiteTest, refId: string): number {
	const existing = test.results[refId];
	if (existing && existing.runs.length > 0) {
		const passes = existing.runs.filter((run) => run.outcome === 'pass').length;
		return Math.min(0.97, Math.max(0.1, passes / existing.runs.length));
	}
	const production = test.results[PRODUCTION_REF_ID];
	if (production && production.runs.length > 0) {
		return production.runs.filter((run) => run.outcome === 'pass').length / production.runs.length;
	}
	return 0.75;
}

function buildTest({
	name,
	prompt,
	sql,
	tags,
	owner,
	addedOnRef,
	history,
}: {
	name: string;
	prompt: string;
	sql: string;
	tags: string[];
	owner: string;
	addedOnRef?: string;
	history: Record<string, string>;
}): SuiteTest {
	const results: Record<string, TargetResult> = {};
	Object.entries(history).forEach(([refId, pattern], index) => {
		results[refId] = patternToResult(pattern, name.length + index);
	});
	return {
		id: name,
		name,
		prompt,
		sql,
		database: 'snowflake',
		tags,
		owner,
		updatedAt: now - (name.length % 9) * DAY,
		addedOnRef,
		results,
	};
}

function patternToResult(pattern: string, seed: number): TargetResult {
	return {
		ranAt: now - ((seed % 5) + 1) * HOUR,
		runs: pattern.split('').map((char, index) => ({
			outcome: char === 'p' ? 'pass' : 'fail',
			durationSeconds: 8 + ((seed * 7 + index * 13) % 30),
			reason: char === 'p' ? undefined : FAILURE_REASONS[(seed + index) % FAILURE_REASONS.length],
		})),
	};
}
