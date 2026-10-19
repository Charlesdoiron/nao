import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths, subYears } from 'date-fns';
import { splitCodeIntoSegments } from '@nao/shared/story-segments';
import { parseStoryTabs, stripStoryTabsMarkup } from '@nao/shared/story-tabs';
import type { ParsedChartBlock, Segment } from '@nao/shared/story-segments';

import type { QueryDataMap } from '@/components/story-embeds';

export type DashboardBlockKind = 'chart' | 'table';
export type DashboardColumnKind = 'date' | 'text' | 'number';
export type DashboardFilterType = 'date_range' | 'values';
export type DatePresetId = 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'previous_year';

export interface DashboardBlock {
	key: string;
	kind: DashboardBlockKind;
	title: string;
	queryId: string;
	chart?: ParsedChartBlock;
	columns: string[];
}

export interface DashboardColumn {
	name: string;
	kind: DashboardColumnKind;
	blockKeys: string[];
}

export interface DateRangeSelection {
	preset: DatePresetId | null;
	from: string;
	to: string;
}

export interface DashboardFilter {
	id: string;
	label: string;
	column: string;
	type: DashboardFilterType;
	targetBlockKeys: string[];
	values: string[];
	dateRange: DateRangeSelection | null;
}

export const DATE_PRESETS: { id: DatePresetId; label: string }[] = [
	{ id: 'this_month', label: 'This month' },
	{ id: 'last_month', label: 'Last month' },
	{ id: 'last_3_months', label: 'Last 3 months' },
	{ id: 'this_year', label: 'This year' },
	{ id: 'previous_year', label: 'Previous year' },
];

const DATE_PATTERN = /^\d{4}-\d{2}(-\d{2})?([T ].*)?$/;
const ISO_DAY_LENGTH = 10;

export function collectDashboardBlocksFromCode(code: string, queryData: QueryDataMap | null): DashboardBlock[] {
	const tabs = parseStoryTabs(code);
	const segments = tabs?.length
		? tabs.flatMap((tab) => splitCodeIntoSegments(tab.innerCode))
		: splitCodeIntoSegments(stripStoryTabsMarkup(code));
	return collectDashboardBlocks(segments, queryData);
}

export function collectDashboardBlocks(segments: Segment[], queryData: QueryDataMap | null): DashboardBlock[] {
	const blocksByKey = new Map<string, DashboardBlock>();

	const visit = (segment: Segment) => {
		if (segment.type === 'grid') {
			segment.children.forEach(visit);
			return;
		}
		if (segment.type !== 'chart' && segment.type !== 'table') {
			return;
		}
		const block = segment.type === 'chart' ? segment.chart : segment.table;
		const key = getDashboardBlockKey(segment.type, block.queryId, block.title);
		if (blocksByKey.has(key)) {
			return;
		}
		blocksByKey.set(key, {
			key,
			kind: segment.type,
			title: block.title || block.queryId,
			queryId: block.queryId,
			chart: segment.type === 'chart' ? segment.chart : undefined,
			columns: queryData?.[block.queryId]?.columns ?? [],
		});
	};

	segments.forEach(visit);
	return [...blocksByKey.values()];
}

export function getDashboardBlockKey(kind: DashboardBlockKind, queryId: string, title: string): string {
	return `${kind}:${queryId}:${title}`;
}

export function listFilterableColumns(blocks: DashboardBlock[], queryData: QueryDataMap | null): DashboardColumn[] {
	const columnsByName = new Map<string, DashboardColumn>();

	for (const block of blocks) {
		const rows = queryData?.[block.queryId]?.data ?? [];
		for (const column of block.columns) {
			const existing = columnsByName.get(column);
			if (existing) {
				existing.blockKeys.push(block.key);
				continue;
			}
			columnsByName.set(column, { name: column, kind: detectColumnKind(rows, column), blockKeys: [block.key] });
		}
	}

	return [...columnsByName.values()].sort(compareColumns);
}

export function detectColumnKind(rows: Record<string, unknown>[], column: string): DashboardColumnKind {
	const sample = rows.map((row) => row[column]).find((value) => value !== null && value !== undefined);
	if (typeof sample === 'number') {
		return 'number';
	}
	if (typeof sample === 'string' && DATE_PATTERN.test(sample)) {
		return 'date';
	}
	return 'text';
}

export function getDistinctValues(rowSets: Record<string, unknown>[][], column: string): string[] {
	const values = new Set<string>();
	for (const rows of rowSets) {
		for (const row of rows) {
			const value = row[column];
			if (value !== null && value !== undefined && value !== '') {
				values.add(String(value));
			}
		}
	}
	return [...values].sort((a, b) => a.localeCompare(b));
}

export function resolveDatePreset(preset: DatePresetId, today: Date = new Date()): { from: string; to: string } {
	const toIsoDay = (date: Date) => format(date, 'yyyy-MM-dd');
	switch (preset) {
		case 'this_month':
			return { from: toIsoDay(startOfMonth(today)), to: toIsoDay(endOfMonth(today)) };
		case 'last_month': {
			const lastMonth = subMonths(today, 1);
			return { from: toIsoDay(startOfMonth(lastMonth)), to: toIsoDay(endOfMonth(lastMonth)) };
		}
		case 'last_3_months':
			return { from: toIsoDay(startOfMonth(subMonths(today, 3))), to: toIsoDay(endOfMonth(subMonths(today, 1))) };
		case 'this_year':
			return { from: toIsoDay(startOfYear(today)), to: toIsoDay(endOfYear(today)) };
		case 'previous_year': {
			const lastYear = subYears(today, 1);
			return { from: toIsoDay(startOfYear(lastYear)), to: toIsoDay(endOfYear(lastYear)) };
		}
	}
}

export function isDashboardFilterActive(filter: DashboardFilter): boolean {
	if (filter.type === 'date_range') {
		return Boolean(filter.dateRange?.from || filter.dateRange?.to);
	}
	return filter.values.length > 0;
}

export function applyDashboardFilters(
	rows: Record<string, unknown>[],
	blockKey: string,
	filters: DashboardFilter[],
): Record<string, unknown>[] {
	const applicable = filters.filter(
		(filter) => filter.targetBlockKeys.includes(blockKey) && isDashboardFilterActive(filter),
	);
	if (applicable.length === 0) {
		return rows;
	}
	return rows.filter((row) => applicable.every((filter) => rowMatchesFilter(row, filter)));
}

export function getActiveFiltersForBlock(blockKey: string, filters: DashboardFilter[]): DashboardFilter[] {
	return filters.filter((filter) => filter.targetBlockKeys.includes(blockKey) && isDashboardFilterActive(filter));
}

export function describeDashboardFilter(filter: DashboardFilter): string {
	if (filter.type === 'date_range') {
		const preset = DATE_PRESETS.find((candidate) => candidate.id === filter.dateRange?.preset);
		if (preset) {
			return preset.label;
		}
		if (!filter.dateRange?.from && !filter.dateRange?.to) {
			return 'All time';
		}
		return `${filter.dateRange?.from || '…'} → ${filter.dateRange?.to || '…'}`;
	}
	if (filter.values.length === 0) {
		return 'All';
	}
	return filter.values.length === 1 ? filter.values[0] : `${filter.values.length} selected`;
}

export function humanizeColumnName(column: string): string {
	const words = column.replace(/[_-]+/g, ' ').trim().toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

function rowMatchesFilter(row: Record<string, unknown>, filter: DashboardFilter): boolean {
	if (!(filter.column in row)) {
		return true;
	}
	const value = row[filter.column];
	if (filter.type === 'values') {
		return filter.values.includes(String(value));
	}
	const day = String(value ?? '').slice(0, ISO_DAY_LENGTH);
	const { from, to } = filter.dateRange ?? { from: '', to: '' };
	return (!from || day >= from) && (!to || day <= to);
}

function compareColumns(a: DashboardColumn, b: DashboardColumn): number {
	const kindOrder: Record<DashboardColumnKind, number> = { date: 0, text: 1, number: 2 };
	return (
		kindOrder[a.kind] - kindOrder[b.kind] || b.blockKeys.length - a.blockKeys.length || a.name.localeCompare(b.name)
	);
}
