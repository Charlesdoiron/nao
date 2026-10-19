import { isFilterSelectionActive, renderFilterSqlValue, renderSqlTemplate } from '@nao/shared/sql-template';
import type { StoryFilterSelection, StoryFilterSelections } from '@nao/shared/sql-template';
import type { ParsedFilterBlock } from '@nao/shared/story-segments';

type Row = Record<string, unknown>;

export interface FilterTestInput {
	sql: string;
	filters: ParsedFilterBlock[];
	selections: StoryFilterSelections;
	rows: Row[];
	columns: string[];
}

export interface FilterTestResult {
	renderedSql: string | null;
	error: string | null;
	rows: Row[];
	baselineRowCount: number;
	appliedFilterIds: string[];
	unsimulatedFilterIds: string[];
}

/**
 * Renders the SQL template with test values, then applies the same values to the rows already loaded
 * for the chart. This prototype stands in for a warehouse round trip on the rendered SQL.
 */
export function runFilterTest({ sql, filters, selections, rows, columns }: FilterTestInput): FilterTestResult {
	const activeFilters = filters.filter((filter) => isFilterSelectionActive(filter.filterType, selections[filter.id]));
	const base = { baselineRowCount: rows.length, appliedFilterIds: activeFilters.map((filter) => filter.id) };

	let renderedSql: string;
	try {
		renderedSql = renderSqlTemplate(sql, selections, buildFilterTypes(filters));
	} catch (error) {
		const message = error instanceof Error ? error.message : 'The SQL template could not be rendered.';
		return { ...base, renderedSql: null, error: message, rows: [], unsimulatedFilterIds: [] };
	}

	const unsimulatedFilterIds: string[] = [];
	const filteredRows = activeFilters.reduce((currentRows, filter) => {
		const column = resolveColumn(columns, filter.column ?? filter.id);
		if (!column) {
			unsimulatedFilterIds.push(filter.id);
			return currentRows;
		}
		return currentRows.filter((row) => matchesSelection(filter, selections[filter.id], row[column]));
	}, rows);

	return { ...base, renderedSql, error: null, rows: filteredRows, unsimulatedFilterIds };
}

export function renderFilterClause(
	clause: string,
	filter: ParsedFilterBlock,
	selection: StoryFilterSelection | undefined,
) {
	const value = renderFilterSqlValue(filter.filterType, selection);
	if (value === null) {
		return null;
	}
	return clause.replace(/\{\{\s*filters\.[A-Za-z_][A-Za-z0-9_]*\.sql\s*\}\}/g, value);
}

export function buildFilterTypes(filters: ParsedFilterBlock[]) {
	return Object.fromEntries(filters.map((filter) => [filter.id, filter.filterType]));
}

function resolveColumn(columns: string[], name: string): string | undefined {
	const bareName = name.split('.').pop()?.toLowerCase();
	return columns.find((column) => column.toLowerCase() === bareName);
}

function matchesSelection(filter: ParsedFilterBlock, selection: StoryFilterSelection | undefined, value: unknown) {
	const text = value === null || value === undefined ? '' : String(value);
	switch (filter.filterType) {
		case 'select':
			return text === selection;
		case 'multi_select':
			return Array.isArray(selection) && selection.includes(text);
		case 'search':
			return typeof selection === 'string' && text.toLowerCase().includes(selection.trim().toLowerCase());
		case 'date_range': {
			const [from, to] = Array.isArray(selection) ? selection : [];
			const day = text.slice(0, 10);
			return day >= from && day <= to;
		}
	}
}
