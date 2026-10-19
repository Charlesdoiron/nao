import { isIsoDateLike } from '@nao/shared/date';
import { formatColumnLabel } from '@nao/shared/story-table-utils';
import {
	endOfMonth,
	endOfQuarter,
	endOfYear,
	format,
	startOfMonth,
	startOfQuarter,
	startOfYear,
	subDays,
	subMonths,
	subQuarters,
	subYears,
} from 'date-fns';
import type { Segment } from '@nao/shared/story-segments';

import type { QueryDataMap } from '@/components/story-embeds';

export type ManualFilterKind = 'date' | 'category';
export type StoryBlockKind = 'chart' | 'table' | 'map';
export type CategoryOperator = 'is' | 'is_not';

export const DATE_PRESETS = [
	{ id: 'this_month', label: 'This month' },
	{ id: 'last_month', label: 'Last month' },
	{ id: 'last_30_days', label: 'Last 30 days' },
	{ id: 'last_90_days', label: 'Last 90 days' },
	{ id: 'this_quarter', label: 'This quarter' },
	{ id: 'last_quarter', label: 'Last quarter' },
	{ id: 'this_year', label: 'This year' },
	{ id: 'previous_year', label: 'Previous year' },
] as const;

export type DatePresetId = (typeof DATE_PRESETS)[number]['id'];

export type ManualDateRange = { mode: 'preset'; preset: DatePresetId } | { mode: 'custom'; from: string; to: string };

export interface StoryBlockRef {
	queryId: string;
	title: string;
	kind: StoryBlockKind;
}

export interface ManualFilterField {
	column: string;
	label: string;
	kind: ManualFilterKind;
	queryIds: string[];
}

export interface ManualFilterTarget {
	queryId: string;
	column: string;
}

interface ManualFilterBase {
	id: string;
	column: string;
	label: string;
	targets: ManualFilterTarget[];
}

export type ManualFilter =
	| (ManualFilterBase & { kind: 'date'; range: ManualDateRange })
	| (ManualFilterBase & { kind: 'category'; operator: CategoryOperator; values: string[] });

export interface DistinctValue {
	value: string;
	count: number;
}

const MAX_CATEGORY_VALUES = 100;
const DATE_KEY_LENGTH = 10;

export function collectStoryBlocks(segments: Segment[]): StoryBlockRef[] {
	const blocksByQuery = new Map<string, StoryBlockRef>();
	for (const block of flattenBlocks(segments)) {
		const existing = blocksByQuery.get(block.queryId);
		if (!existing) {
			blocksByQuery.set(block.queryId, block);
		} else if (block.title && !existing.title.includes(block.title)) {
			existing.title = existing.title ? `${existing.title}, ${block.title}` : block.title;
		}
	}
	return [...blocksByQuery.values()];
}

export function discoverFilterFields(blocks: StoryBlockRef[], queryData: QueryDataMap | null): ManualFilterField[] {
	const fieldsByKey = new Map<string, ManualFilterField>();
	for (const block of blocks) {
		const result = queryData?.[block.queryId];
		if (!result) {
			continue;
		}
		for (const column of getResultColumns(result)) {
			const kind = inferColumnKind(result.data, column);
			if (!kind) {
				continue;
			}
			const key = `${kind}:${column}`;
			const field = fieldsByKey.get(key) ?? { column, label: formatColumnLabel(column), kind, queryIds: [] };
			field.queryIds.push(block.queryId);
			fieldsByKey.set(key, field);
		}
	}
	return [...fieldsByKey.values()].sort(compareFields);
}

/**
 * Date filters can map onto any date column of a block (e.g. `order_date` and `month`),
 * category filters only onto a column with the same name.
 */
export function getTargetCandidates(
	queryData: QueryDataMap | null,
	queryId: string,
	field: Pick<ManualFilterField, 'kind' | 'column'>,
): string[] {
	const result = queryData?.[queryId];
	if (!result) {
		return [];
	}
	const columns = getResultColumns(result).filter((column) => inferColumnKind(result.data, column) === field.kind);
	if (field.kind === 'category') {
		return columns.filter((column) => column === field.column);
	}
	return columns.includes(field.column)
		? [field.column, ...columns.filter((column) => column !== field.column)]
		: columns;
}

export function getDefaultTargets(
	field: ManualFilterField,
	blocks: StoryBlockRef[],
	queryData: QueryDataMap | null,
): ManualFilterTarget[] {
	return blocks.flatMap((block) => {
		const [column] = getTargetCandidates(queryData, block.queryId, field);
		return column ? [{ queryId: block.queryId, column }] : [];
	});
}

export function createDraftFilter(field: ManualFilterField, targets: ManualFilterTarget[]): ManualFilter {
	const base = { id: crypto.randomUUID(), column: field.column, label: field.label, targets };
	return field.kind === 'date'
		? { ...base, kind: 'date', range: { mode: 'preset', preset: 'last_month' } }
		: { ...base, kind: 'category', operator: 'is', values: [] };
}

export function getDistinctValues(queryData: QueryDataMap | null, targets: ManualFilterTarget[]): DistinctValue[] {
	const counts = new Map<string, number>();
	for (const target of targets) {
		for (const row of queryData?.[target.queryId]?.data ?? []) {
			const value = row[target.column];
			if (value === null || value === undefined || value === '') {
				continue;
			}
			const key = String(value);
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
	}
	return [...counts.entries()]
		.map(([value, count]) => ({ value, count }))
		.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function applyManualFilters(queryData: QueryDataMap | null, filters: ManualFilter[]): QueryDataMap | null {
	const activeFilters = filters.filter(isManualFilterActive);
	if (!queryData || activeFilters.length === 0) {
		return queryData;
	}
	const filtered: QueryDataMap = { ...queryData };
	for (const [queryId, result] of Object.entries(queryData)) {
		const predicates = activeFilters.flatMap((filter) =>
			filter.targets
				.filter((target) => target.queryId === queryId)
				.map((target) => buildRowPredicate(filter, target.column)),
		);
		if (predicates.length > 0) {
			filtered[queryId] = { ...result, data: result.data.filter((row) => predicates.every((test) => test(row))) };
		}
	}
	return filtered;
}

export function isManualFilterActive(filter: ManualFilter): boolean {
	if (filter.targets.length === 0) {
		return false;
	}
	return filter.kind === 'date' ? true : filter.values.length > 0;
}

export function resolveDateRange(range: ManualDateRange, today = new Date()): { from: Date; to: Date } {
	if (range.mode === 'custom') {
		return { from: parseDateKey(range.from), to: parseDateKey(range.to) };
	}
	switch (range.preset) {
		case 'this_month':
			return { from: startOfMonth(today), to: today };
		case 'last_month':
			return { from: startOfMonth(subMonths(today, 1)), to: endOfMonth(subMonths(today, 1)) };
		case 'last_30_days':
			return { from: subDays(today, 29), to: today };
		case 'last_90_days':
			return { from: subDays(today, 89), to: today };
		case 'this_quarter':
			return { from: startOfQuarter(today), to: today };
		case 'last_quarter':
			return { from: startOfQuarter(subQuarters(today, 1)), to: endOfQuarter(subQuarters(today, 1)) };
		case 'this_year':
			return { from: startOfYear(today), to: today };
		case 'previous_year':
			return { from: startOfYear(subYears(today, 1)), to: endOfYear(subYears(today, 1)) };
	}
}

export function formatDateRange({ from, to }: { from: Date; to: Date }): string {
	if (from.getFullYear() !== to.getFullYear()) {
		return `${format(from, 'MMM d, yyyy')} – ${format(to, 'MMM d, yyyy')}`;
	}
	if (from.getMonth() === to.getMonth()) {
		return `${format(from, 'MMM d')} – ${format(to, 'd, yyyy')}`;
	}
	return `${format(from, 'MMM d')} – ${format(to, 'MMM d, yyyy')}`;
}

export function describeFilterValue(filter: ManualFilter): string {
	if (filter.kind === 'date') {
		return describeDateRange(filter.range);
	}
	const [first, ...rest] = filter.values;
	if (!first) {
		return 'Any';
	}
	const values = rest.length > 0 ? `${first} +${rest.length}` : first;
	return filter.operator === 'is_not' ? `not ${values}` : values;
}

export function describeDateRange(range: ManualDateRange): string {
	if (range.mode === 'preset') {
		return DATE_PRESETS.find((preset) => preset.id === range.preset)?.label ?? '';
	}
	return formatDateRange(resolveDateRange(range));
}

export function toDateKey(date: Date): string {
	return format(date, 'yyyy-MM-dd');
}

function buildRowPredicate(filter: ManualFilter, column: string): (row: Record<string, unknown>) => boolean {
	if (filter.kind === 'date') {
		const { from, to } = resolveDateRange(filter.range);
		const fromKey = toDateKey(from);
		const toKey = toDateKey(to);
		return (row) => {
			const key = String(row[column] ?? '').slice(0, DATE_KEY_LENGTH);
			return key >= fromKey && key <= toKey;
		};
	}
	const selected = new Set(filter.values);
	const keepSelected = filter.operator === 'is';
	return (row) => selected.has(String(row[column] ?? '')) === keepSelected;
}

function inferColumnKind(rows: Record<string, unknown>[], column: string): ManualFilterKind | null {
	const values = rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined);
	if (values.length === 0) {
		return null;
	}
	if (values.every(isIsoDateLike)) {
		return 'date';
	}
	if (!values.every((value) => typeof value === 'string')) {
		return null;
	}
	return new Set(values).size <= MAX_CATEGORY_VALUES ? 'category' : null;
}

function getResultColumns(result: QueryDataMap[string]): string[] {
	return result.columns.length > 0 ? result.columns : Object.keys(result.data[0] ?? {});
}

function flattenBlocks(segments: Segment[]): StoryBlockRef[] {
	return segments.flatMap((segment): StoryBlockRef[] => {
		switch (segment.type) {
			case 'chart':
				return [{ queryId: segment.chart.queryId, title: segment.chart.title, kind: 'chart' }];
			case 'table':
				return [{ queryId: segment.table.queryId, title: segment.table.title, kind: 'table' }];
			case 'map':
				return [{ queryId: segment.map.queryId, title: segment.map.title, kind: 'map' }];
			case 'grid':
				return flattenBlocks(segment.children);
			default:
				return [];
		}
	});
}

function compareFields(a: ManualFilterField, b: ManualFilterField): number {
	if (a.kind !== b.kind) {
		return a.kind === 'date' ? -1 : 1;
	}
	return b.queryIds.length - a.queryIds.length || a.label.localeCompare(b.label);
}

function parseDateKey(value: string): Date {
	const [year, month, day] = value.split('-').map(Number);
	return new Date(year, (month ?? 1) - 1, day ?? 1);
}
