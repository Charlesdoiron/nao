import { findUnreferencedStoryFilters, validateSqlFilterTemplate } from '@nao/shared/sql-template';
import type { StoryFilterType } from '@nao/shared/sql-template';
import type { ParsedFilterBlock } from '@nao/shared/story-segments';

export type FilterLintSeverity = 'error' | 'warning';

export interface FilterLintIssue {
	severity: FilterLintSeverity;
	message: string;
	filterId?: string;
	start?: number;
	end?: number;
}

export interface FilterBlockUsage {
	filterId: string;
	start: number;
	end: number;
	line: number;
	clause: string;
}

export interface SqlFilterLint {
	usages: FilterBlockUsage[];
	issues: FilterLintIssue[];
	unusedFilterIds: string[];
}

const FILTER_BLOCK_REGEX = /\{%\s*filter\s+([A-Za-z_][A-Za-z0-9_]*)\s*%\}([\s\S]*?)\{%\s*endfilter\s*%\}/g;
const LEADING_CONNECTOR_REGEX = /^\s*(?:and|or)\b/i;
const QUERY_TAIL_REGEX = /^[ \t]*(?:group\s+by|order\s+by|having|limit|qualify)\b/im;

const OPERATOR_RULES: Record<StoryFilterType, { pattern: RegExp; hint: (id: string) => string }> = {
	select: {
		pattern: /(?:=|\bin\s*\()\s*\{\{/i,
		hint: (id) => `A select filter expands to one quoted value. Compare it with = {{ filters.${id}.sql }}.`,
	},
	multi_select: {
		pattern: /\bin\s*\(\s*\{\{/i,
		hint: (id) => `A multi select filter expands to a list ('a', 'b'). Wrap it as IN ({{ filters.${id}.sql }}).`,
	},
	search: {
		pattern: /\bi?like\s*\{\{/i,
		hint: (id) => `A search filter expands to a '%term%' pattern. Match it with ILIKE {{ filters.${id}.sql }}.`,
	},
	date_range: {
		pattern: /\bbetween\s*\{\{/i,
		hint: (id) => `A date range expands to 'start' AND 'end'. Use BETWEEN {{ filters.${id}.sql }}.`,
	},
};

const SNIPPET_COMPARISONS: Record<StoryFilterType, (placeholder: string) => string> = {
	select: (placeholder) => `= ${placeholder}`,
	multi_select: (placeholder) => `IN (${placeholder})`,
	search: (placeholder) => `ILIKE ${placeholder}`,
	date_range: (placeholder) => `BETWEEN ${placeholder}`,
};

/** Locates every `{% filter %}` block of a query and reports template errors and risky comparisons. */
export function lintSqlFilters(sql: string, filters: ParsedFilterBlock[]): SqlFilterLint {
	const filterById = new Map(filters.map((filter) => [filter.id, filter]));
	const knownFilterIds = [...filterById.keys()];
	const usages = findFilterBlockUsages(sql);
	const blockIssues = usages.flatMap((usage) =>
		lintFilterBlock(sql, usage, filterById.get(usage.filterId), knownFilterIds),
	);
	const blockMessages = new Set(blockIssues.map((issue) => issue.message));
	const templateIssues = validateSqlFilterTemplate(sql, { knownFilterIds })
		.filter((message) => !blockMessages.has(message))
		.map((message): FilterLintIssue => ({ severity: 'error', message }));

	return {
		usages,
		issues: [...templateIssues, ...blockIssues],
		unusedFilterIds: findUnreferencedStoryFilters(knownFilterIds, [sql]),
	};
}

export function buildFilterSnippet(filter: ParsedFilterBlock): string {
	const column = filter.column ?? filter.id;
	const comparison = SNIPPET_COMPARISONS[filter.filterType](`{{ filters.${filter.id}.sql }}`);
	return `{% filter ${filter.id} %} AND ${column} ${comparison} {% endfilter %}`;
}

/** Inserts a filter block before the query tail (GROUP BY, ORDER BY…), adding a WHERE clause when missing. */
export function insertFilterSnippet(
	sql: string,
	filter: ParsedFilterBlock,
): { sql: string; start: number; end: number } {
	const snippet = /\bwhere\b/i.test(sql)
		? buildFilterSnippet(filter)
		: `WHERE 1 = 1\n  ${buildFilterSnippet(filter)}`;
	const tail = QUERY_TAIL_REGEX.exec(sql);
	const insertAt = tail ? tail.index : sql.trimEnd().length;
	const prefix = sql.slice(0, insertAt).trimEnd();
	const suffix = sql.slice(insertAt);
	const separator = '\n  ';
	const start = prefix.length + separator.length;
	const next = `${prefix}${separator}${snippet}${suffix ? `\n${suffix}` : '\n'}`;
	return { sql: next, start, end: start + snippet.length };
}

export function issuesForFilter(lint: SqlFilterLint, filterId: string): FilterLintIssue[] {
	return lint.issues.filter((issue) => issue.filterId === filterId);
}

export function countIssues(issues: FilterLintIssue[], severity: FilterLintSeverity): number {
	return issues.filter((issue) => issue.severity === severity).length;
}

function findFilterBlockUsages(sql: string): FilterBlockUsage[] {
	return [...sql.matchAll(new RegExp(FILTER_BLOCK_REGEX.source, 'g'))].map((match) => ({
		filterId: match[1],
		start: match.index,
		end: match.index + match[0].length,
		line: sql.slice(0, match.index).split('\n').length,
		clause: match[2].replace(/\s+/g, ' ').trim(),
	}));
}

function lintFilterBlock(
	sql: string,
	usage: FilterBlockUsage,
	filter: ParsedFilterBlock | undefined,
	knownFilterIds: string[],
): FilterLintIssue[] {
	const location = { filterId: usage.filterId, start: usage.start, end: usage.end };
	const templateErrors = validateSqlFilterTemplate(sql.slice(usage.start, usage.end), { knownFilterIds }).map(
		(message): FilterLintIssue => ({ severity: 'error', message, ...location }),
	);
	if (templateErrors.length > 0 || !filter) {
		return templateErrors;
	}

	const warnings: FilterLintIssue[] = [];
	const rule = OPERATOR_RULES[filter.filterType];
	if (!rule.pattern.test(usage.clause)) {
		warnings.push({ severity: 'warning', message: rule.hint(filter.id), ...location });
	}
	if (!LEADING_CONNECTOR_REGEX.test(usage.clause)) {
		warnings.push({
			severity: 'warning',
			message: `Start the block with AND so the query stays valid when "${filter.label}" is left empty.`,
			...location,
		});
	}
	return warnings;
}
