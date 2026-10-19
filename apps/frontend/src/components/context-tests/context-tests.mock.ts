export type TestTargetKind = 'production' | 'branch' | 'tag';

export interface TestTarget {
	kind: TestTargetKind;
	ref: string;
}

export interface ContextTestOwner {
	id: string;
	name: string;
	initials: string;
}

export interface ContextTest {
	id: string;
	name: string;
	prompt: string;
	expectedSql?: string;
	tags: string[];
	ownerId: string;
	readsFiles: string[];
	productionPassRate: number | null;
	isDraft: boolean;
}

export interface ContextBranch {
	name: string;
	authorId: string;
	updatedLabel: string;
	changedFiles: string[];
}

export interface ContextReleaseTag {
	name: string;
	dateLabel: string;
}

export const CURRENT_USER_ID = 'claire';

export const PRODUCTION_DEPLOYMENT = {
	ref: 'main',
	commit: '4f2a91c',
	deployedLabel: 'deployed 3 days ago',
};

export const COST_PER_RUN_USD = 0.08;
export const SECONDS_PER_RUN = 40;
export const PARALLEL_RUNS = 4;

export const testOwners: ContextTestOwner[] = [
	{ id: 'claire', name: 'Claire Martin', initials: 'CM' },
	{ id: 'tomas', name: 'Tomás Ruiz', initials: 'TR' },
	{ id: 'priya', name: 'Priya Shah', initials: 'PS' },
	{ id: 'jonas', name: 'Jonas Becker', initials: 'JB' },
];

export const contextBranches: ContextBranch[] = [
	{
		name: 'claire/revenue-definitions',
		authorId: 'claire',
		updatedLabel: 'updated 2 hours ago',
		changedFiles: ['semantics/revenue.md', 'databases/duckdb/main/orders/columns.md', 'docs/refund-policy.md'],
	},
	{
		name: 'tomas/marketing-attribution',
		authorId: 'tomas',
		updatedLabel: 'updated yesterday',
		changedFiles: ['semantics/attribution.md', 'databases/duckdb/main/campaigns/description.md'],
	},
	{
		name: 'priya/retention-cohorts',
		authorId: 'priya',
		updatedLabel: 'updated 4 days ago',
		changedFiles: ['semantics/retention.md'],
	},
];

export const contextReleaseTags: ContextReleaseTag[] = [
	{ name: 'v2026.10.2', dateLabel: 'Oct 14' },
	{ name: 'v2026.10.1', dateLabel: 'Oct 2' },
	{ name: 'v2026.09.3', dateLabel: 'Sep 24' },
];

export const initialContextTests: ContextTest[] = [
	{
		id: 'revenue_total',
		name: 'revenue_total',
		prompt: 'What is the total revenue from all orders?',
		expectedSql: 'SELECT SUM(amount) AS total_revenue\nFROM orders',
		tags: ['finance', 'revenue'],
		ownerId: 'priya',
		readsFiles: ['semantics/revenue.md', 'databases/duckdb/main/orders/columns.md'],
		productionPassRate: 1,
		isDraft: false,
	},
	{
		id: 'revenue_by_month',
		name: 'revenue_by_month',
		prompt: 'Show monthly revenue for the last 12 months',
		tags: ['finance', 'revenue'],
		ownerId: 'priya',
		readsFiles: ['semantics/revenue.md'],
		productionPassRate: 0.93,
		isDraft: false,
	},
	{
		id: 'revenue_net_of_refunds',
		name: 'revenue_net_of_refunds',
		prompt: 'What was net revenue last quarter after refunds?',
		tags: ['finance', 'revenue'],
		ownerId: 'claire',
		readsFiles: ['semantics/revenue.md', 'docs/refund-policy.md'],
		productionPassRate: 0.47,
		isDraft: false,
	},
	{
		id: 'revenue_by_channel',
		name: 'revenue_by_channel',
		prompt: 'Which acquisition channel brought the most revenue this year?',
		tags: ['marketing', 'revenue'],
		ownerId: 'tomas',
		readsFiles: ['semantics/revenue.md', 'semantics/attribution.md'],
		productionPassRate: 0.87,
		isDraft: false,
	},
	{
		id: 'customers_top_10',
		name: 'customers_top_10',
		prompt: 'Who are our top 10 customers by lifetime value?',
		tags: ['finance', 'kpi'],
		ownerId: 'jonas',
		readsFiles: ['databases/duckdb/main/orders/columns.md', 'databases/duckdb/main/customers/columns.md'],
		productionPassRate: 0.93,
		isDraft: false,
	},
	{
		id: 'marketing_cac_by_channel',
		name: 'marketing_cac_by_channel',
		prompt: 'What is our customer acquisition cost by channel?',
		tags: ['marketing', 'kpi'],
		ownerId: 'tomas',
		readsFiles: ['semantics/attribution.md', 'databases/duckdb/main/campaigns/description.md'],
		productionPassRate: 0.67,
		isDraft: false,
	},
	{
		id: 'marketing_campaign_roi',
		name: 'marketing_campaign_roi',
		prompt: 'Which campaigns had a positive ROI last month?',
		tags: ['marketing'],
		ownerId: 'tomas',
		readsFiles: ['databases/duckdb/main/campaigns/description.md'],
		productionPassRate: 0.73,
		isDraft: false,
	},
	{
		id: 'retention_cohort_m3',
		name: 'retention_cohort_m3',
		prompt: 'What is 3-month retention for the January cohort?',
		tags: ['retention'],
		ownerId: 'priya',
		readsFiles: ['semantics/retention.md'],
		productionPassRate: 0.6,
		isDraft: false,
	},
	{
		id: 'retention_monthly_churn',
		name: 'retention_monthly_churn',
		prompt: 'What was monthly churn in September?',
		tags: ['retention', 'kpi'],
		ownerId: 'priya',
		readsFiles: ['semantics/retention.md'],
		productionPassRate: 0.93,
		isDraft: false,
	},
	{
		id: 'product_weekly_active_users',
		name: 'product_weekly_active_users',
		prompt: 'How many weekly active users do we have?',
		tags: ['product', 'kpi'],
		ownerId: 'jonas',
		readsFiles: ['semantics/product.md'],
		productionPassRate: 1,
		isDraft: false,
	},
	{
		id: 'product_export_adoption',
		name: 'product_export_adoption',
		prompt: 'What share of active users used exports last week?',
		tags: ['product'],
		ownerId: 'jonas',
		readsFiles: ['semantics/product.md'],
		productionPassRate: 0.8,
		isDraft: false,
	},
	{
		id: 'ops_late_deliveries',
		name: 'ops_late_deliveries',
		prompt: 'How many orders were delivered late last month?',
		tags: ['ops'],
		ownerId: 'claire',
		readsFiles: ['databases/duckdb/main/orders/columns.md'],
		productionPassRate: 0.93,
		isDraft: false,
	},
	{
		id: 'ops_fulfillment_time',
		name: 'ops_fulfillment_time',
		prompt: 'What is the average fulfillment time by warehouse?',
		tags: ['ops'],
		ownerId: 'claire',
		readsFiles: ['databases/duckdb/main/warehouses/description.md'],
		productionPassRate: 0.87,
		isDraft: false,
	},
	{
		id: 'customers_new_this_week',
		name: 'customers_new_this_week',
		prompt: 'How many new customers signed up this week?',
		tags: ['product', 'kpi'],
		ownerId: 'jonas',
		readsFiles: ['databases/duckdb/main/customers/columns.md'],
		productionPassRate: 1,
		isDraft: false,
	},
];

export const allTestTags = ['finance', 'revenue', 'marketing', 'retention', 'product', 'ops', 'kpi'];

const tagSuggestionRules: { pattern: RegExp; tags: string[] }[] = [
	{ pattern: /revenue|refund|sales|ltv|lifetime value/i, tags: ['finance', 'revenue'] },
	{ pattern: /campaign|channel|acquisition|cac|roi/i, tags: ['marketing'] },
	{ pattern: /churn|retention|cohort/i, tags: ['retention'] },
	{ pattern: /active users|feature|adoption|signup|signed up/i, tags: ['product'] },
	{ pattern: /deliver|warehouse|fulfil|shipping/i, tags: ['ops'] },
];

const branchPassRates: Record<string, Record<string, number>> = {
	'claire/revenue-definitions': {
		revenue_total: 1,
		revenue_by_month: 1,
		revenue_net_of_refunds: 1,
		revenue_by_channel: 0.34,
		customers_top_10: 0.67,
		ops_late_deliveries: 1,
	},
	'tomas/marketing-attribution': {
		revenue_by_channel: 1,
		marketing_cac_by_channel: 1,
		marketing_campaign_roi: 0.67,
	},
	'priya/retention-cohorts': {
		retention_cohort_m3: 1,
		retention_monthly_churn: 0.67,
	},
};

const failureReasons: Record<string, string[]> = {
	revenue_by_channel: [
		'Summed net revenue instead of gross. The new definition in semantics/revenue.md is applied to channel attribution too.',
		'Joined orders to campaigns on order date instead of first touch, so 312 orders moved to "direct".',
	],
	customers_top_10: ['Lifetime value excluded refunded orders, which reordered customers #7 to #10.'],
	revenue_net_of_refunds: ['Refunds were not subtracted: the answer used orders.amount without the refunds table.'],
	marketing_cac_by_channel: ['Spend for the "partners" channel was double counted across two campaign tables.'],
	retention_cohort_m3: ['Cohort was built on first order instead of signup date.'],
};

const slugStopWords = [
	'what',
	'which',
	'who',
	'how',
	'many',
	'is',
	'are',
	'was',
	'were',
	'do',
	'did',
	'the',
	'a',
	'an',
	'of',
	'for',
	'in',
	'our',
	'we',
	'show',
	'me',
];

const defaultFailureReason = 'Result differs from the expected query: 2 of 12 rows do not match.';

export function findOwner(ownerId: string): ContextTestOwner {
	return testOwners.find((owner) => owner.id === ownerId) ?? testOwners[0];
}

export function findBranch(name: string): ContextBranch | undefined {
	return contextBranches.find((branch) => branch.name === name);
}

export function changedFilesForTarget(target: TestTarget): string[] {
	if (target.kind !== 'branch') {
		return [];
	}
	return findBranch(target.ref)?.changedFiles ?? [];
}

export function isTestLikelyAffected(test: ContextTest, changedFiles: string[]): boolean {
	return test.readsFiles.some((file) => changedFiles.includes(file));
}

export function describeTarget(target: TestTarget): string {
	if (target.kind === 'production') {
		return 'production';
	}
	return target.ref;
}

export function suggestTags(prompt: string): string[] {
	const suggestions = tagSuggestionRules.filter((rule) => rule.pattern.test(prompt)).flatMap((rule) => rule.tags);
	return [...new Set(suggestions)];
}

export function slugifyTestName(prompt: string): string {
	return prompt
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, '')
		.trim()
		.split(/\s+/)
		.filter((word) => !slugStopWords.includes(word))
		.slice(0, 5)
		.join('_');
}

export function expectedPassRate(test: ContextTest, target: TestTarget): number {
	if (target.kind === 'branch') {
		const branchRate = branchPassRates[target.ref]?.[test.id];
		if (branchRate !== undefined) {
			return branchRate;
		}
	}
	return test.productionPassRate ?? 0.67;
}

export function mockRunPasses(test: ContextTest, target: TestTarget, runIndex: number, repeats: number): boolean {
	const failingRuns = repeats - Math.round(expectedPassRate(test, target) * repeats);
	const failuresBefore = Math.floor((runIndex * failingRuns) / repeats);
	const failuresIncludingThis = Math.floor(((runIndex + 1) * failingRuns) / repeats);
	return failuresIncludingThis === failuresBefore;
}

export function mockFailureReason(testId: string, runIndex: number): string {
	const reasons = failureReasons[testId] ?? [defaultFailureReason];
	return reasons[runIndex % reasons.length];
}

export function mockRunDurationMs(testId: string, runIndex: number): number {
	const seed = [...testId].reduce((total, char) => total + char.charCodeAt(0), 0) + runIndex * 37;
	return 700 + (seed % 9) * 120;
}
