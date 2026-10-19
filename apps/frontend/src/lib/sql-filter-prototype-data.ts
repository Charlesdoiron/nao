import type { StoryFilterSelection, StoryFilterSelections } from '@nao/shared/sql-template';
import type { ParsedFilterBlock } from '@nao/shared/story-segments';
import type { executeSql } from '@nao/shared/tools';

import type {
	SqlFilterEditing,
	SqlFilterTestRequest,
	SqlFilterTestResult,
} from '@/components/side-panel/sql-filter-query-editor';
import type { SqlField, SqlFilterClause } from '@/lib/sql-filter-clauses';

type OrderRow = Record<string, string | number>;

export const PROTOTYPE_STORY_FILTERS: ParsedFilterBlock[] = [
	{ id: 'region', label: 'Region', filterType: 'select', options: ['EMEA', 'North America', 'APAC', 'LATAM'] },
	{ id: 'channel', label: 'Channel', filterType: 'multi_select', options: ['Online', 'Retail', 'Partner'] },
	{ id: 'period', label: 'Order period', filterType: 'date_range' },
	{ id: 'customer', label: 'Customer', filterType: 'search' },
];

export const PROTOTYPE_FIELDS: SqlField[] = [
	{ name: 'order_id', type: 'number' },
	{ name: 'order_date', type: 'date' },
	{ name: 'region', type: 'text' },
	{ name: 'channel', type: 'text' },
	{ name: 'status', type: 'text' },
	{ name: 'customer_name', type: 'text' },
	{ name: 'revenue', type: 'number' },
	{ name: 'discount', type: 'number' },
];

export const PROTOTYPE_VALID_SQL = `SELECT
  DATE_TRUNC('month', order_date) AS month,
  SUM(revenue) AS revenue,
  COUNT(DISTINCT order_id) AS orders
FROM analytics.orders
WHERE status = 'completed'
  {% filter region %} AND region = {{ filters.region.sql }} {% endfilter %}
  {% filter channel %} AND channel IN ({{ filters.channel.sql }}) {% endfilter %}
  {% filter period %} AND order_date BETWEEN {{ filters.period.sql }} {% endfilter %}
GROUP BY 1
ORDER BY 1`;

export const PROTOTYPE_INVALID_SQL = `SELECT
  DATE_TRUNC('month', order_date) AS month,
  SUM(revenue) AS revenue,
  COUNT(DISTINCT order_id) AS orders
FROM analytics.orders
WHERE status = 'completed'
  {% filter region %} AND regionn = {{ filters.region.sql }} {% endfilter %}
  {% filter channel %} AND channel = {{ filters.channel.sql }} {% endfilter %}
  {% filter country %} AND country = {{ filters.country.sql }} {% endfilter %}
GROUP BY 1
ORDER BY 1`;

export const PROTOTYPE_TEST_VALUES: StoryFilterSelections = {
	region: 'EMEA',
	channel: ['Online', 'Partner'],
	period: ['2026-01-01', '2026-06-30'],
};

const ORDERS = generateOrders();

export const PROTOTYPE_OUTPUT: executeSql.Output = {
	id: 'query_monthly_revenue' as executeSql.Output['id'],
	columns: ['month', 'revenue', 'orders'],
	data: aggregateByMonth(ORDERS),
	row_count: 12,
	dialect: 'duckdb',
};

export function createPrototypeFilterEditing(): SqlFilterEditing {
	return {
		storyFilters: PROTOTYPE_STORY_FILTERS,
		fields: PROTOTYPE_FIELDS,
		sourceTable: 'analytics.orders',
		initialTestValues: PROTOTYPE_TEST_VALUES,
		runTest: runPrototypeTest,
		save: () => wait(400),
	};
}

async function runPrototypeTest(request: SqlFilterTestRequest): Promise<SqlFilterTestResult> {
	await wait(450);
	const rows = request.clauses.reduce(
		(remaining, clause) => applyClause(remaining, clause, request.testValues[clause.filterId]),
		ORDERS,
	);
	return { columns: ['month', 'revenue', 'orders'], rows: aggregateByMonth(rows) };
}

function applyClause(
	rows: OrderRow[],
	clause: SqlFilterClause,
	selection: StoryFilterSelection | undefined,
): OrderRow[] {
	const values = (Array.isArray(selection) ? selection : selection ? [selection] : []).filter(Boolean);
	if (values.length === 0) {
		return rows;
	}
	if (!(clause.column in ORDERS[0])) {
		throw new Error(`Binder Error: Referenced column "${clause.column}" not found in FROM clause!`);
	}
	const read = (row: OrderRow) => String(row[clause.column]);
	switch (clause.operator) {
		case '=':
		case 'IN':
			return rows.filter((row) => values.includes(read(row)));
		case '!=':
		case 'NOT IN':
			return rows.filter((row) => !values.includes(read(row)));
		case 'LIKE':
		case 'ILIKE':
			return rows.filter((row) => read(row).toLowerCase().includes(values[0].toLowerCase()));
		case 'BETWEEN':
			return rows.filter((row) => read(row) >= values[0] && read(row) <= values[1]);
	}
}

function aggregateByMonth(rows: OrderRow[]): Record<string, unknown>[] {
	const byMonth = new Map<string, { revenue: number; orders: number }>();
	for (const row of rows) {
		const month = `${String(row.order_date).slice(0, 7)}-01`;
		const current = byMonth.get(month) ?? { revenue: 0, orders: 0 };
		byMonth.set(month, { revenue: current.revenue + Number(row.revenue), orders: current.orders + 1 });
	}
	return [...byMonth.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([month, totals]) => ({ month, revenue: Math.round(totals.revenue), orders: totals.orders }));
}

function generateOrders(): OrderRow[] {
	const regions = ['EMEA', 'North America', 'APAC', 'LATAM'];
	const channels = ['Online', 'Retail', 'Partner'];
	const customers = ['Acme Corp', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark Industries'];
	let seed = 42;
	const random = () => {
		seed = (seed * 1103515245 + 12345) % 2147483648;
		return seed / 2147483648;
	};
	return Array.from({ length: 2400 }, (_, index) => {
		const monthIndex = Math.min(11, Math.floor(Math.sqrt(random()) * 12));
		const year = monthIndex < 6 ? 2025 : 2026;
		const month = ((monthIndex + 6) % 12) + 1;
		const day = 1 + Math.floor(random() * 28);
		return {
			order_id: index + 1,
			order_date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
			region: regions[Math.floor(random() * regions.length)],
			channel: channels[Math.floor(random() * channels.length)],
			customer_name: customers[Math.floor(random() * customers.length)],
			revenue: 80 + random() * 420 * (1 + monthIndex / 10),
		};
	});
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
