import { renderSqlTemplate, validateSqlFilterTemplate } from '@nao/shared/sql-template';
import type { StoryFilterSelections, StoryFilterType } from '@nao/shared/sql-template';
import type { ParsedFilterBlock } from '@nao/shared/story-segments';

export const SQL_FILTER_OPERATORS = ['=', '!=', 'IN', 'NOT IN', 'ILIKE', 'LIKE', 'BETWEEN'] as const;

export type SqlFilterOperator = (typeof SQL_FILTER_OPERATORS)[number];

export type SqlFieldType = 'text' | 'number' | 'date' | 'boolean';

export interface SqlField {
	name: string;
	type: SqlFieldType;
}

export interface SqlFilterClause {
	key: string;
	filterId: string;
	column: string;
	operator: SqlFilterOperator;
	/** Raw Jinja condition kept as-is when the block does not match the structured `AND col op value` shape. */
	customCondition?: string;
}

export interface SqlFilterDocument {
	sql: string;
	clauses: SqlFilterClause[];
}

export type SqlFilterLintField = 'filterId' | 'column' | 'operator' | 'placement' | 'condition';

export interface SqlFilterLintIssue {
	clauseKey: string | null;
	field: SqlFilterLintField | null;
	severity: 'error' | 'warning';
	message: string;
}

export const OPERATORS_BY_FILTER_TYPE: Record<StoryFilterType, SqlFilterOperator[]> = {
	select: ['=', '!='],
	multi_select: ['IN', 'NOT IN'],
	search: ['ILIKE', 'LIKE'],
	date_range: ['BETWEEN'],
};

const FILTER_BLOCK_REGEX = /\{%\s*filter\s+([A-Za-z_][A-Za-z0-9_]*)\s*%\}([\s\S]*?)\{%\s*endfilter\s*%\}/g;
const MARKER_REGEX = /\/\*\s*filter:\s*([A-Za-z_][A-Za-z0-9_]*)\s*\*\//g;
const STRUCTURED_CONDITION_REGEX =
	/^\s*AND\s+(.+?)\s*(\bNOT\s+IN\b|\bIN\b|\bILIKE\b|\bLIKE\b|\bBETWEEN\b|!=|<>|=)\s*\(?\s*\{\{\s*filters\.([A-Za-z_][A-Za-z0-9_]*)\.sql\s*\}\}\s*\)?\s*$/i;
const CLAUSE_END_KEYWORD_REGEX = /\b(GROUP\s+BY|ORDER\s+BY|HAVING|QUALIFY|LIMIT|WINDOW|UNION)\b/gi;

let clauseKeyCounter = 0;

export function createClauseKey(): string {
	clauseKeyCounter += 1;
	return `clause-${clauseKeyCounter}`;
}

export function buildFilterMarker(filterId: string): string {
	return `/* filter: ${filterId} */`;
}

/** Splits a Jinja SQL template into readable SQL (filter blocks replaced by markers) and structured clauses. */
export function parseSqlFilterDocument(templateSql: string): SqlFilterDocument {
	const clauses: SqlFilterClause[] = [];
	const sql = templateSql.replace(FILTER_BLOCK_REGEX, (_block, filterId: string, condition: string) => {
		clauses.push(parseClause(filterId, condition));
		return buildFilterMarker(filterId);
	});
	return { sql, clauses };
}

/** Expands every marker back into its `{% filter %}` block, producing the template that is saved. */
export function buildSqlFilterTemplate(document: SqlFilterDocument): string {
	const consumed = new Set<string>();
	return document.sql.replace(MARKER_REGEX, (marker, filterId: string) => {
		const clause = document.clauses.find(
			(candidate) => candidate.filterId === filterId && !consumed.has(candidate.key),
		);
		if (!clause) {
			return marker;
		}
		consumed.add(clause.key);
		return buildFilterBlock(clause);
	});
}

export function buildFilterBlock(clause: SqlFilterClause): string {
	return `{% filter ${clause.filterId} %} ${buildClauseCondition(clause)} {% endfilter %}`;
}

export function buildClauseCondition(clause: SqlFilterClause): string {
	if (clause.customCondition !== undefined) {
		return clause.customCondition.trim();
	}
	const placeholder = `{{ filters.${clause.filterId}.sql }}`;
	const value = clause.operator === 'IN' || clause.operator === 'NOT IN' ? `(${placeholder})` : placeholder;
	return `AND ${clause.column || '<field>'} ${clause.operator} ${value}`;
}

/** Renders the final SQL sent to the warehouse for the given test values (unset filters are dropped). */
export function compileSqlFilterQuery(
	document: SqlFilterDocument,
	storyFilters: ParsedFilterBlock[],
	testValues: StoryFilterSelections,
): string {
	const types = Object.fromEntries(storyFilters.map((filter) => [filter.id, filter.filterType]));
	return renderSqlTemplate(buildSqlFilterTemplate(document), testValues, types);
}

export function lintSqlFilterDocument(
	document: SqlFilterDocument,
	{ storyFilters, fields }: { storyFilters: ParsedFilterBlock[]; fields: SqlField[] },
): SqlFilterLintIssue[] {
	const markers = findFilterMarkers(document.sql);
	const issues = document.clauses.flatMap((clause) =>
		lintClause(clause, { document, markers, storyFilters, fields }),
	);
	issues.push(...lintOrphanMarkers(document, markers));
	issues.push(...lintRenderedTemplate(document, storyFilters, issues));
	return issues;
}

export interface FilterMarker {
	filterId: string;
	start: number;
	end: number;
}

export function findFilterMarkers(sql: string): FilterMarker[] {
	return [...sql.matchAll(new RegExp(MARKER_REGEX.source, 'g'))].map((match) => ({
		filterId: match[1],
		start: match.index,
		end: match.index + match[0].length,
	}));
}

/** Pairs each clause with the marker it expands into, following the same order rules as `buildSqlFilterTemplate`. */
export function matchClauseMarkers(document: SqlFilterDocument): Map<string, FilterMarker> {
	const markers = findFilterMarkers(document.sql);
	const matched = new Map<string, FilterMarker>();
	const consumed = new Set<string>();
	for (const marker of markers) {
		const clause = document.clauses.find(
			(candidate) => candidate.filterId === marker.filterId && !consumed.has(candidate.key),
		);
		if (clause) {
			consumed.add(clause.key);
			matched.set(clause.key, marker);
		}
	}
	return matched;
}

/** Inserts a marker where a new condition belongs: at the end of the WHERE clause, creating one if needed. */
export function insertFilterMarker(sql: string, filterId: string): string {
	const marker = buildFilterMarker(filterId);
	const whereIndex = findLastWhereIndex(sql);
	const searchFrom = whereIndex ?? 0;
	const endIndex = findClauseEndIndex(sql, searchFrom);
	const before = sql.slice(0, endIndex).replace(/\s+$/, '');
	const after = sql.slice(endIndex);
	const insertion = whereIndex === null ? `\nWHERE 1 = 1\n  ${marker}` : `\n  ${marker}`;
	return `${before}${insertion}${after ? `\n${after.replace(/^\s+/, '')}` : '\n'}`;
}

export function renameFilterMarker(document: SqlFilterDocument, clauseKey: string, nextFilterId: string): string {
	const marker = matchClauseMarkers(document).get(clauseKey);
	if (!marker) {
		return document.sql;
	}
	return `${document.sql.slice(0, marker.start)}${buildFilterMarker(nextFilterId)}${document.sql.slice(marker.end)}`;
}

export function removeFilterMarker(document: SqlFilterDocument, clauseKey: string): string {
	const marker = matchClauseMarkers(document).get(clauseKey);
	if (!marker) {
		return document.sql;
	}
	const lineStart = document.sql.lastIndexOf('\n', marker.start - 1) + 1;
	const lineEnd = document.sql.indexOf('\n', marker.end);
	const isAloneOnLine =
		document.sql.slice(lineStart, marker.start).trim() === '' &&
		document.sql.slice(marker.end, lineEnd === -1 ? undefined : lineEnd).trim() === '';
	if (isAloneOnLine) {
		return `${document.sql.slice(0, lineStart)}${lineEnd === -1 ? '' : document.sql.slice(lineEnd + 1)}`;
	}
	return `${document.sql.slice(0, marker.start)}${document.sql.slice(marker.end)}`;
}

function parseClause(filterId: string, condition: string): SqlFilterClause {
	const match = condition.match(STRUCTURED_CONDITION_REGEX);
	const operator = match ? normalizeOperator(match[2]) : null;
	if (!match || !operator || match[3] !== filterId) {
		return { key: createClauseKey(), filterId, column: '', operator: '=', customCondition: condition.trim() };
	}
	return { key: createClauseKey(), filterId, column: match[1].trim(), operator };
}

function normalizeOperator(raw: string): SqlFilterOperator | null {
	const operator = raw.toUpperCase().replace(/\s+/g, ' ');
	if (operator === '<>') {
		return '!=';
	}
	return (SQL_FILTER_OPERATORS as readonly string[]).includes(operator) ? (operator as SqlFilterOperator) : null;
}

interface ClauseLintContext {
	document: SqlFilterDocument;
	markers: FilterMarker[];
	storyFilters: ParsedFilterBlock[];
	fields: SqlField[];
}

function lintClause(clause: SqlFilterClause, context: ClauseLintContext): SqlFilterLintIssue[] {
	const issue = (field: SqlFilterLintField, message: string, severity: 'error' | 'warning' = 'error') => ({
		clauseKey: clause.key,
		field,
		severity,
		message,
	});
	const issues: SqlFilterLintIssue[] = [];
	const storyFilter = context.storyFilters.find((filter) => filter.id === clause.filterId);

	if (!storyFilter) {
		issues.push(
			issue(
				'filterId',
				`Not declared in this story. Add <filter id="${clause.filterId}" /> or pick another variable.`,
			),
		);
	}

	issues.push(...lintPlacement(clause, context).map((message) => issue('placement', message)));

	if (clause.customCondition !== undefined) {
		const blockIssues = validateSqlFilterTemplate(buildFilterBlock(clause));
		issues.push(...blockIssues.map((message) => issue('condition', message)));
		return issues;
	}

	const field = context.fields.find((candidate) => candidate.name.toLowerCase() === clause.column.toLowerCase());
	if (!clause.column.trim()) {
		issues.push(issue('column', 'Pick the field this filter applies to.'));
	} else if (!field) {
		const suggestion = suggestField(clause.column, context.fields);
		issues.push(
			issue(
				'column',
				`Field "${clause.column}" does not exist${suggestion ? `. Did you mean "${suggestion}"?` : '.'}`,
			),
		);
	}

	if (storyFilter) {
		const allowed = OPERATORS_BY_FILTER_TYPE[storyFilter.filterType];
		if (!allowed.includes(clause.operator)) {
			issues.push(issue('operator', describeOperatorMismatch(storyFilter.filterType, allowed)));
		}
		if (field && storyFilter.filterType === 'date_range' && field.type !== 'date') {
			issues.push(
				issue('column', `Date range filters need a date field; "${field.name}" is ${field.type}.`, 'warning'),
			);
		}
	}

	return issues;
}

function lintPlacement(clause: SqlFilterClause, { document }: ClauseLintContext): string[] {
	const marker = matchClauseMarkers(document).get(clause.key);
	if (!marker) {
		return ['Not placed in the SQL. The condition will never be applied.'];
	}
	const whereIndex = findLastWhereIndex(document.sql.slice(0, marker.start));
	if (whereIndex === null) {
		return ['Placed outside a WHERE clause. Move it after a WHERE condition (e.g. WHERE 1 = 1).'];
	}
	const clauseEnd = findClauseEndIndex(document.sql, whereIndex);
	if (marker.start > clauseEnd) {
		return ['Placed after GROUP BY / ORDER BY / LIMIT. Move it into the WHERE clause.'];
	}
	return [];
}

function lintOrphanMarkers(document: SqlFilterDocument, markers: FilterMarker[]): SqlFilterLintIssue[] {
	const matched = new Set([...matchClauseMarkers(document).values()].map((marker) => marker.start));
	return markers
		.filter((marker) => !matched.has(marker.start))
		.map((marker) => ({
			clauseKey: null,
			field: null,
			severity: 'error' as const,
			message: `Marker for filters.${marker.filterId} has no condition. Add it in the filter sidebar or remove it.`,
		}));
}

function lintRenderedTemplate(
	document: SqlFilterDocument,
	storyFilters: ParsedFilterBlock[],
	existing: SqlFilterLintIssue[],
): SqlFilterLintIssue[] {
	if (existing.some((issue) => issue.severity === 'error')) {
		return [];
	}
	const knownFilterIds = storyFilters.map((filter) => filter.id);
	return validateSqlFilterTemplate(buildSqlFilterTemplate(document), { knownFilterIds }).map((message) => ({
		clauseKey: null,
		field: null,
		severity: 'error' as const,
		message,
	}));
}

function describeOperatorMismatch(filterType: StoryFilterType, allowed: SqlFilterOperator[]): string {
	const reasons: Record<StoryFilterType, string> = {
		select: 'Single select filters send one value',
		multi_select: 'Multi select filters send a list of values',
		search: "Search filters send a '%text%' pattern",
		date_range: "Date range filters send 'start' AND 'end'",
	};
	return `${reasons[filterType]}; use ${allowed.join(' or ')}.`;
}

function suggestField(column: string, fields: SqlField[]): string | null {
	const target = column.toLowerCase();
	let best: { name: string; distance: number } | null = null;
	for (const field of fields) {
		const distance = levenshteinDistance(target, field.name.toLowerCase());
		if (distance <= 2 && (!best || distance < best.distance)) {
			best = { name: field.name, distance };
		}
	}
	return best?.name ?? null;
}

function levenshteinDistance(a: string, b: string): number {
	const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
	for (let i = 1; i <= a.length; i++) {
		let diagonal = previous[0];
		previous[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const above = previous[j];
			previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
			diagonal = above;
		}
	}
	return previous[b.length];
}

function findLastWhereIndex(sql: string): number | null {
	const matches = [...sql.matchAll(/\bWHERE\b/gi)];
	const last = matches.at(-1);
	return last ? last.index : null;
}

function findClauseEndIndex(sql: string, from: number): number {
	const regex = new RegExp(CLAUSE_END_KEYWORD_REGEX.source, 'gi');
	regex.lastIndex = from;
	const match = regex.exec(sql);
	return match ? match.index : sql.length;
}
