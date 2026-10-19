import { describe, expect, it } from 'vitest';
import {
	buildSqlFilterTemplate,
	compileSqlFilterQuery,
	insertFilterMarker,
	lintSqlFilterDocument,
	parseSqlFilterDocument,
	removeFilterMarker,
	renameFilterMarker,
} from './sql-filter-clauses';
import type { ParsedFilterBlock } from '@nao/shared/story-segments';

import type { SqlField } from './sql-filter-clauses';

const TEMPLATE = [
	'SELECT region, SUM(revenue) AS revenue',
	'FROM orders',
	"WHERE status = 'completed'",
	'  {% filter region %} AND region = {{ filters.region.sql }} {% endfilter %}',
	'  {% filter channel %} AND channel IN ({{ filters.channel.sql }}) {% endfilter %}',
	'  {% filter period %} AND order_date BETWEEN {{ filters.period.sql }} {% endfilter %}',
	'GROUP BY 1',
].join('\n');

const STORY_FILTERS: ParsedFilterBlock[] = [
	{ id: 'region', label: 'Region', filterType: 'select', options: ['EMEA', 'AMER'] },
	{ id: 'channel', label: 'Channel', filterType: 'multi_select', options: ['Online', 'Retail'] },
	{ id: 'period', label: 'Period', filterType: 'date_range' },
];

const FIELDS: SqlField[] = [
	{ name: 'region', type: 'text' },
	{ name: 'channel', type: 'text' },
	{ name: 'order_date', type: 'date' },
	{ name: 'revenue', type: 'number' },
	{ name: 'status', type: 'text' },
];

describe('parseSqlFilterDocument', () => {
	it('replaces filter blocks with readable markers and structured clauses', () => {
		const document = parseSqlFilterDocument(TEMPLATE);

		expect(document.sql).toContain('/* filter: region */');
		expect(document.sql).not.toContain('{%');
		expect(document.clauses.map(({ filterId, column, operator }) => ({ filterId, column, operator }))).toEqual([
			{ filterId: 'region', column: 'region', operator: '=' },
			{ filterId: 'channel', column: 'channel', operator: 'IN' },
			{ filterId: 'period', column: 'order_date', operator: 'BETWEEN' },
		]);
	});

	it('keeps unrecognised conditions as custom Jinja', () => {
		const document = parseSqlFilterDocument(
			'WHERE 1 = 1 {% filter region %} AND lower(region) = lower({{ filters.region.sql }}) OR x = 1 {% endfilter %}',
		);

		expect(document.clauses[0].customCondition).toBe(
			'AND lower(region) = lower({{ filters.region.sql }}) OR x = 1',
		);
	});

	it('round-trips back to an equivalent template', () => {
		const rebuilt = buildSqlFilterTemplate(parseSqlFilterDocument(TEMPLATE));

		expect(rebuilt).toBe(TEMPLATE);
	});
});

describe('compileSqlFilterQuery', () => {
	it('renders test values and drops unset filters', () => {
		const document = parseSqlFilterDocument(TEMPLATE);

		const compiled = compileSqlFilterQuery(document, STORY_FILTERS, { region: 'EMEA', channel: ['Online'] });

		expect(compiled).toContain("AND region = 'EMEA'");
		expect(compiled).toContain("AND channel IN ('Online')");
		expect(compiled).not.toContain('order_date BETWEEN');
	});
});

describe('lintSqlFilterDocument', () => {
	it('reports no issues for a valid document', () => {
		const document = parseSqlFilterDocument(TEMPLATE);

		expect(lintSqlFilterDocument(document, { storyFilters: STORY_FILTERS, fields: FIELDS })).toEqual([]);
	});

	it('flags unknown fields, wrong operators, undeclared filters and missing markers', () => {
		const document = parseSqlFilterDocument(
			[
				'SELECT * FROM orders WHERE 1 = 1',
				'  {% filter region %} AND regionn = {{ filters.region.sql }} {% endfilter %}',
				'  {% filter channel %} AND channel = {{ filters.channel.sql }} {% endfilter %}',
				'  {% filter country %} AND region = {{ filters.country.sql }} {% endfilter %}',
			].join('\n'),
		);
		const withoutChannelMarker = { ...document, sql: document.sql.replace('/* filter: channel */', '') };

		const issues = lintSqlFilterDocument(withoutChannelMarker, { storyFilters: STORY_FILTERS, fields: FIELDS });

		expect(issues.map((issue) => issue.field)).toEqual(['column', 'placement', 'operator', 'filterId']);
		expect(issues[0].message).toContain('Did you mean "region"?');
	});

	it('flags conditions placed after GROUP BY', () => {
		const document = parseSqlFilterDocument(
			'SELECT region FROM orders WHERE 1 = 1 GROUP BY 1 {% filter region %} AND region = {{ filters.region.sql }} {% endfilter %}',
		);

		const issues = lintSqlFilterDocument(document, { storyFilters: STORY_FILTERS, fields: FIELDS });

		expect(issues).toHaveLength(1);
		expect(issues[0].field).toBe('placement');
	});
});

describe('marker helpers', () => {
	it('inserts a marker at the end of the WHERE clause', () => {
		const sql = insertFilterMarker("SELECT * FROM orders WHERE status = 'x'\nGROUP BY 1", 'region');

		expect(sql).toBe("SELECT * FROM orders WHERE status = 'x'\n  /* filter: region */\nGROUP BY 1");
	});

	it('creates a WHERE clause when the query has none', () => {
		const sql = insertFilterMarker('SELECT * FROM orders\nGROUP BY 1', 'region');

		expect(sql).toBe('SELECT * FROM orders\nWHERE 1 = 1\n  /* filter: region */\nGROUP BY 1');
	});

	it('renames and removes the marker of a clause', () => {
		const document = parseSqlFilterDocument(TEMPLATE);
		const regionKey = document.clauses[0].key;

		expect(renameFilterMarker(document, regionKey, 'country')).toContain('/* filter: country */');
		expect(removeFilterMarker(document, regionKey)).not.toContain('/* filter: region */');
	});
});
