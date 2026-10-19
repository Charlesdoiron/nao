import { describe, expect, it } from 'vitest';

import { insertFilterSnippet, lintSqlFilters } from './sql-filter-lint';
import { runFilterTest } from './sql-filter-test-run';
import type { ParsedFilterBlock } from '@nao/shared/story-segments';

const REGION: ParsedFilterBlock = { id: 'region', label: 'Region', filterType: 'select', column: 'region' };
const CHANNELS: ParsedFilterBlock = {
	id: 'channels',
	label: 'Channels',
	filterType: 'multi_select',
	column: 'channel',
};
const PERIOD: ParsedFilterBlock = { id: 'period', label: 'Period', filterType: 'date_range', column: 'month' };

const SQL = [
	'SELECT month, region, channel, revenue',
	'FROM orders',
	'WHERE 1 = 1',
	'  {% filter region %} AND region = {{ filters.region.sql }} {% endfilter %}',
	'  {% filter channels %} AND channel = {{ filters.channels.sql }} {% endfilter %}',
	'GROUP BY 1, 2, 3',
].join('\n');

describe('lintSqlFilters', () => {
	it('locates filter blocks and reports unused declared filters', () => {
		const lint = lintSqlFilters(SQL, [REGION, CHANNELS, PERIOD]);

		expect(lint.usages.map(({ filterId, line }) => ({ filterId, line }))).toEqual([
			{ filterId: 'region', line: 4 },
			{ filterId: 'channels', line: 5 },
		]);
		expect(lint.unusedFilterIds).toEqual(['period']);
	});

	it('warns when the comparison does not fit the filter type', () => {
		const lint = lintSqlFilters(SQL, [REGION, CHANNELS]);

		expect(lint.issues).toEqual([
			expect.objectContaining({
				severity: 'warning',
				filterId: 'channels',
				message: expect.stringContaining('IN ('),
			}),
		]);
	});

	it('reports template errors on the block that causes them', () => {
		const sql =
			'SELECT * FROM orders WHERE 1 = 1 {% filter region %} AND region = {{ filters.region }} {% endfilter %}';
		const lint = lintSqlFilters(sql, [REGION]);

		expect(lint.issues).toEqual([
			expect.objectContaining({ severity: 'error', filterId: 'region', start: 33, end: sql.length }),
		]);
	});

	it('flags blocks referencing a filter the story does not declare', () => {
		const lint = lintSqlFilters(SQL, [REGION]);

		expect(lint.issues).toContainEqual(
			expect.objectContaining({
				severity: 'error',
				filterId: 'channels',
				message: expect.stringContaining('undeclared'),
			}),
		);
	});
});

describe('insertFilterSnippet', () => {
	it('inserts the block before GROUP BY', () => {
		const { sql } = insertFilterSnippet(SQL, PERIOD);

		expect(sql).toContain(
			'{% filter period %} AND month BETWEEN {{ filters.period.sql }} {% endfilter %}\nGROUP BY',
		);
	});

	it('adds a WHERE clause when the query has none', () => {
		const { sql } = insertFilterSnippet('SELECT * FROM orders', REGION);

		expect(sql).toBe(
			'SELECT * FROM orders\n  WHERE 1 = 1\n  {% filter region %} AND region = {{ filters.region.sql }} {% endfilter %}\n',
		);
	});
});

describe('runFilterTest', () => {
	const rows = [
		{ month: '2026-01-01', region: 'EMEA', revenue: 10 },
		{ month: '2026-02-01', region: 'EMEA', revenue: 12 },
		{ month: '2026-02-01', region: 'APAC', revenue: 7 },
	];
	const columns = ['month', 'region', 'revenue'];
	const sql =
		'SELECT * FROM orders WHERE 1 = 1 {% filter region %} AND region = {{ filters.region.sql }} {% endfilter %} {% filter period %} AND month BETWEEN {{ filters.period.sql }} {% endfilter %}';

	it('renders the SQL and applies every active test value', () => {
		const result = runFilterTest({
			sql,
			filters: [REGION, PERIOD],
			selections: { region: 'EMEA', period: ['2026-02-01', '2026-03-01'] },
			rows,
			columns,
		});

		expect(result.renderedSql).toContain("AND region = 'EMEA'");
		expect(result.renderedSql).toContain("AND month BETWEEN '2026-02-01' AND '2026-03-01'");
		expect(result.rows).toEqual([rows[1]]);
		expect(result.appliedFilterIds).toEqual(['region', 'period']);
	});

	it('returns the template error instead of rows', () => {
		const result = runFilterTest({ sql, filters: [REGION], selections: {}, rows, columns });

		expect(result.error).toContain('period');
		expect(result.rows).toEqual([]);
	});
});
