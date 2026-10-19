import { describe, expect, it } from 'vitest';

import { analyzeSqlFilterTemplate, buildFilterBlockSnippet, findFilterInsertOffset } from './sql-filter-template';

const SQL = `SELECT country, SUM(amount) AS revenue
FROM orders
WHERE 1 = 1
{% filter country %} AND country IN ({{ filters.country.sql }}) {% endfilter %}
{% filter period %} AND order_date BETWEEN {{ filters.period.sql }} {% endfilter %}
GROUP BY country`;

describe('analyzeSqlFilterTemplate', () => {
	it('locates blocks and tokens without issues for a valid template', () => {
		const analysis = analyzeSqlFilterTemplate(SQL, { knownFilterIds: ['country', 'period'] });

		expect(analysis.issues).toEqual([]);
		expect(analysis.referencedFilterIds).toEqual(['country', 'period']);
		expect(analysis.blocks).toHaveLength(2);
		const [countryBlock] = analysis.blocks;
		expect(SQL.slice(countryBlock.start, countryBlock.end)).toBe(
			'{% filter country %} AND country IN ({{ filters.country.sql }}) {% endfilter %}',
		);
		expect(SQL.slice(countryBlock.innerStart, countryBlock.innerEnd)).toBe(
			' AND country IN ({{ filters.country.sql }}) ',
		);
		expect(analysis.tokens.map((token) => token.kind)).toEqual([
			'open',
			'placeholder',
			'close',
			'open',
			'placeholder',
			'close',
		]);
	});

	it('pins issues to the offending token', () => {
		const sql = `SELECT 1 FROM orders WHERE 1 = 1
{% filter regionx %} AND region = {{ filters.regionx.sql }} {% endfilter %}
{% filter period %} AND order_date BETWEEN {{ filters.period.start }} {% endfilter %}
AND x = {{ filters.country.sql }}
{{ filter.typo }}`;
		const analysis = analyzeSqlFilterTemplate(sql, { knownFilterIds: ['country', 'period'] });
		const issueAt = (raw: string) => analysis.issues.find((token) => token.raw === raw)?.issue;

		expect(issueAt('{% filter regionx %}')).toMatch(/not declared/);
		expect(issueAt('{{ filters.period.start }}')).toMatch(/BETWEEN \{\{ filters\.period\.sql \}\}/);
		expect(issueAt('{{ filters.country.sql }}')).toMatch(/must be wrapped/);
		expect(issueAt('{{ filter.typo }}')).toMatch(/Unsupported template expression/);
		expect(analysis.blocks.every((block) => block.hasIssue)).toBe(true);
	});

	it('flags unclosed, orphan and mismatched blocks', () => {
		const unclosed = analyzeSqlFilterTemplate('{% filter country %} AND country = {{ filters.country.sql }}');
		expect(unclosed.issues[0].issue).toMatch(/never closed/);

		const orphan = analyzeSqlFilterTemplate('SELECT 1 {% endfilter %}');
		expect(orphan.issues[0].issue).toMatch(/no matching/);

		const mismatched = analyzeSqlFilterTemplate(
			'{% filter country %} AND country = {{ filters.period.sql }} {% endfilter %}',
		);
		expect(mismatched.issues[0].issue).toMatch(/belongs to "period"/);

		const unused = analyzeSqlFilterTemplate("{% filter country %} AND country = 'US' {% endfilter %}");
		expect(unused.issues[0].issue).toMatch(/never uses the selected value/);
	});
});

describe('findFilterInsertOffset', () => {
	it('inserts before the trailing GROUP BY of the outer query', () => {
		const offset = findFilterInsertOffset(SQL);
		expect(SQL.slice(offset)).toBe('\nGROUP BY country');
	});

	it('falls back to the end of the query, ignoring a trailing semicolon', () => {
		const sql = 'SELECT * FROM orders WHERE 1 = 1;\n';
		expect(sql.slice(0, findFilterInsertOffset(sql))).toBe('SELECT * FROM orders WHERE 1 = 1');
	});
});

describe('buildFilterBlockSnippet', () => {
	it('uses the right operator for each filter type', () => {
		expect(buildFilterBlockSnippet('country', 'country', 'multi_select')).toBe(
			'{% filter country %} AND country IN ({{ filters.country.sql }}) {% endfilter %}',
		);
		expect(buildFilterBlockSnippet('period', 'order_date', 'date_range')).toContain(
			'order_date BETWEEN {{ filters.period.sql }}',
		);
	});
});
