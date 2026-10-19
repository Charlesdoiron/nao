import type { ContextRef, ContextTest, TestOwner } from '@/lib/context-tests';

export const MOCK_OWNERS: TestOwner[] = [
	{ id: 'claire', name: 'Claire Dubois', email: 'claire@jaffle.shop' },
	{ id: 'mehdi', name: 'Mehdi Benali', email: 'mehdi@jaffle.shop' },
	{ id: 'ana', name: 'Ana Ruiz', email: 'ana@jaffle.shop' },
	{ id: 'thomas', name: 'Thomas Martin', email: 'thomas@jaffle.shop' },
];

export const MOCK_REFS: ContextRef[] = [
	{ id: 'main', label: 'main', kind: 'branch', isProduction: true, commit: 'a1f93c2' },
	{
		id: 'feature/refund-definitions',
		label: 'feature/refund-definitions',
		kind: 'branch',
		ownerId: 'thomas',
		commit: '7d02be1',
	},
	{ id: 'feature/customer-docs', label: 'feature/customer-docs', kind: 'branch', ownerId: 'ana', commit: 'c44e9a0' },
	{ id: 'v2.4.0', label: 'v2.4.0', kind: 'tag', commit: '5b8e113' },
];

/** Joined tables a change can ripple into, used to rank "likely affected" tests. */
export const MOCK_TABLE_JOINS: Record<string, string[]> = {
	orders: ['customers', 'payments'],
	customers: ['orders'],
	payments: ['orders'],
};

/** Pass rate a test reaches once the given table's context is edited, to simulate the impact of a draft. */
export const MOCK_DRAFT_PASS_RATES: Record<string, Record<string, number>> = {
	orders: { total_revenue: 2 / 3, revenue_by_month: 1 / 3, orders_refund_rate: 1, customers_lifetime_value: 2 / 3 },
	customers: { customers_new_by_month: 1, customers_first_order: 2 / 3 },
	payments: { revenue_by_payment_method: 1, payments_coupon_share: 2 / 3 },
};

export const MOCK_REF_PASS_RATES: Record<string, Record<string, number>> = {
	'feature/refund-definitions': MOCK_DRAFT_PASS_RATES.orders,
	'feature/customer-docs': MOCK_DRAFT_PASS_RATES.customers,
	'v2.4.0': { orders_refund_rate: 0, payments_coupon_share: 0 },
};

export const MOCK_TESTS: ContextTest[] = [
	{
		id: 'total_revenue',
		name: 'total_revenue',
		prompt: 'What is the total revenue from all orders?',
		sql: 'SELECT SUM(amount) AS total_revenue\nFROM orders',
		tags: ['revenue', 'finance'],
		ownerId: 'claire',
		branch: 'main',
		tables: ['orders'],
		baseline: { passes: 3, runs: 3, ref: 'main', ranAt: hoursAgo(2) },
	},
	{
		id: 'revenue_by_month',
		name: 'revenue_by_month',
		prompt: 'Show monthly revenue for 2018',
		sql: "SELECT DATE_TRUNC('month', order_date) AS month, SUM(amount) AS revenue\nFROM orders\nWHERE status <> 'returned'\nGROUP BY 1\nORDER BY 1",
		tags: ['revenue', 'finance', 'time-series'],
		ownerId: 'claire',
		branch: 'main',
		tables: ['orders'],
		baseline: { passes: 3, runs: 3, ref: 'main', ranAt: hoursAgo(2) },
	},
	{
		id: 'revenue_by_payment_method',
		name: 'revenue_by_payment_method',
		prompt: 'Break down revenue by payment method',
		sql: 'SELECT payment_method, SUM(amount) AS revenue\nFROM payments\nGROUP BY 1',
		tags: ['revenue', 'payments'],
		ownerId: 'mehdi',
		branch: 'main',
		tables: ['payments', 'orders'],
		baseline: { passes: 2, runs: 3, ref: 'main', ranAt: hoursAgo(2) },
	},
	{
		id: 'orders_completed_count',
		name: 'orders_completed_count',
		prompt: 'How many orders were completed?',
		sql: "SELECT COUNT(*) FROM orders WHERE status = 'completed'",
		tags: ['orders', 'ops'],
		ownerId: 'mehdi',
		branch: 'main',
		tables: ['orders'],
		baseline: { passes: 3, runs: 3, ref: 'main', ranAt: hoursAgo(2) },
	},
	{
		id: 'orders_refund_rate',
		name: 'orders_refund_rate',
		prompt: 'What share of orders were returned or refunded last quarter?',
		sql: "SELECT AVG(CASE WHEN status IN ('returned', 'return_pending') THEN 1 ELSE 0 END) AS refund_rate\nFROM orders",
		tags: ['orders', 'ops', 'refunds'],
		ownerId: 'thomas',
		branch: 'feature/refund-definitions',
		tables: ['orders'],
		baseline: { passes: 1, runs: 3, ref: 'main', ranAt: hoursAgo(2) },
	},
	{
		id: 'customers_lifetime_value',
		name: 'customers_lifetime_value',
		prompt: 'Who are the top 10 customers by lifetime value?',
		sql: 'SELECT customer_id, first_name, last_name, customer_lifetime_value\nFROM customers\nORDER BY customer_lifetime_value DESC\nLIMIT 10',
		tags: ['customers', 'revenue'],
		ownerId: 'ana',
		branch: 'main',
		tables: ['customers'],
		baseline: { passes: 3, runs: 3, ref: 'main', ranAt: hoursAgo(2) },
	},
	{
		id: 'customers_first_order',
		name: 'customers_first_order',
		prompt: 'When did each customer place their first order?',
		sql: 'SELECT customer_id, first_order FROM customers',
		tags: ['customers'],
		ownerId: 'ana',
		branch: 'feature/customer-docs',
		tables: ['customers'],
		baseline: { passes: 3, runs: 3, ref: 'main', ranAt: hoursAgo(26) },
	},
	{
		id: 'customers_new_by_month',
		name: 'customers_new_by_month',
		prompt: 'How many new customers did we get each month?',
		sql: "SELECT DATE_TRUNC('month', first_order) AS month, COUNT(*) AS new_customers\nFROM customers\nGROUP BY 1\nORDER BY 1",
		tags: ['customers', 'time-series'],
		ownerId: 'claire',
		branch: 'main',
		tables: ['customers'],
		baseline: { passes: 2, runs: 3, ref: 'main', ranAt: hoursAgo(26) },
	},
	{
		id: 'payments_avg_amount',
		name: 'payments_avg_amount',
		prompt: 'What is the average payment amount?',
		sql: 'SELECT AVG(amount) FROM payments',
		tags: ['payments', 'finance'],
		ownerId: 'mehdi',
		branch: 'main',
		tables: ['payments'],
		baseline: { passes: 3, runs: 3, ref: 'main', ranAt: hoursAgo(26) },
	},
	{
		id: 'payments_coupon_share',
		name: 'payments_coupon_share',
		prompt: 'What percentage of payments used a coupon?',
		sql: "SELECT AVG(CASE WHEN payment_method = 'coupon' THEN 1 ELSE 0 END) FROM payments",
		tags: ['payments'],
		ownerId: 'thomas',
		branch: 'feature/refund-definitions',
		tables: ['payments'],
		baseline: null,
	},
];

function hoursAgo(hours: number): string {
	return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}
