import {
	endOfMonth,
	endOfQuarter,
	endOfYear,
	format,
	startOfMonth,
	startOfQuarter,
	startOfYear,
	subMonths,
	subYears,
} from 'date-fns';
import { pluralize } from '@nao/shared';
import { parseStoryTabs, stripStoryTabsMarkup } from '@nao/shared/story-tabs';
import { splitCodeIntoSegments } from '@nao/shared/story-segments';
import type { ParsedChartBlock, ParsedTableBlock, Segment } from '@nao/shared/story-segments';

import type { QueryDataMap } from '@/components/story-embeds';

export type StoryControlBlock =
	| { id: string; kind: 'chart'; queryId: string; title: string; chart: ParsedChartBlock }
	| { id: string; kind: 'table'; queryId: string; title: string; table: ParsedTableBlock };

export type StoryColumnKind = 'date' | 'number' | 'category';

export interface StoryControlColumn {
	name: string;
	label: string;
	kind: StoryColumnKind;
	blockIds: string[];
}

export const DATE_PRESETS = [
	{ id: 'this_month', label: 'This month' },
	{ id: 'last_month', label: 'Last month' },
	{ id: 'this_quarter', label: 'This quarter' },
	{ id: 'last_3_months', label: 'Last 3 months' },
	{ id: 'this_year', label: 'This year' },
	{ id: 'previous_year', label: 'Previous year' },
	{ id: 'custom', label: 'Custom' },
] as const;

export type DatePresetId = (typeof DATE_PRESETS)[number]['id'];

export type DateRangeValue = { from: string; to: string };

interface ManualFilterBase {
	id: string;
	column: string;
	blockIds: string[];
}

export type ManualFilter =
	| (ManualFilterBase & { kind: 'values'; values: string[] })
	| (ManualFilterBase & { kind: 'date'; preset: DatePresetId; customRange: DateRangeValue });

export interface BlockDisplaySettings {
	chartType?: string;
	xAxisKey?: string;
	seriesKeys?: string[];
	showDataLabels?: boolean;
	visibleColumns?: string[];
}

export const CHART_SERIES_COLORS = [
	'var(--chart-1)',
	'var(--chart-2)',
	'var(--chart-3)',
	'var(--chart-4)',
	'var(--chart-5)',
];

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;
const DATE_FORMAT = 'yyyy-MM-dd';

export function collectStoryBlocks(code: string): StoryControlBlock[] {
	const tabs = parseStoryTabs(code);
	const segments = tabs?.length
		? tabs.flatMap((tab) => splitCodeIntoSegments(tab.innerCode))
		: splitCodeIntoSegments(stripStoryTabsMarkup(code));
	return flattenSegments(segments).flatMap(toControlBlock);
}

export function getChartBlockId(chart: ParsedChartBlock): string {
	return `chart:${chart.queryId}:${chart.title}`;
}

export function getTableBlockId(table: ParsedTableBlock): string {
	return `table:${table.queryId}:${table.title}`;
}

export function collectStoryColumns(blocks: StoryControlBlock[], queryData: QueryDataMap | null): StoryControlColumn[] {
	const columns = new Map<string, StoryControlColumn>();
	for (const block of blocks) {
		const result = queryData?.[block.queryId];
		if (!result) {
			continue;
		}
		for (const name of getResultColumns(result)) {
			const kind = inferColumnKind(name, result.data, block);
			const existing = columns.get(name);
			if (existing) {
				existing.blockIds.push(block.id);
				existing.kind = existing.kind === 'date' || kind === 'date' ? 'date' : existing.kind;
				continue;
			}
			columns.set(name, { name, label: humanizeColumnName(name), kind, blockIds: [block.id] });
		}
	}
	return [...columns.values()];
}

export function getFilterableColumns(columns: StoryControlColumn[]): StoryControlColumn[] {
	return columns.filter((column) => column.kind !== 'number');
}

export function getDistinctColumnValues(
	columnName: string,
	blocks: StoryControlBlock[],
	queryData: QueryDataMap | null,
): { value: string; count: number }[] {
	const counts = new Map<string, number>();
	const seenQueryIds = new Set<string>();
	for (const block of blocks) {
		const result = queryData?.[block.queryId];
		if (!result || seenQueryIds.has(block.queryId)) {
			continue;
		}
		seenQueryIds.add(block.queryId);
		for (const row of result.data) {
			const value = row[columnName];
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

export function resolveDateRange(filter: Extract<ManualFilter, { kind: 'date' }>, today = new Date()): DateRangeValue {
	if (filter.preset === 'custom') {
		return filter.customRange;
	}
	return resolveDatePreset(filter.preset, today);
}

export function resolveDatePreset(preset: Exclude<DatePresetId, 'custom'>, today = new Date()): DateRangeValue {
	switch (preset) {
		case 'this_month':
			return toRange(startOfMonth(today), endOfMonth(today));
		case 'last_month': {
			const lastMonth = subMonths(today, 1);
			return toRange(startOfMonth(lastMonth), endOfMonth(lastMonth));
		}
		case 'this_quarter':
			return toRange(startOfQuarter(today), endOfQuarter(today));
		case 'last_3_months':
			return toRange(startOfMonth(subMonths(today, 2)), endOfMonth(today));
		case 'this_year':
			return toRange(startOfYear(today), endOfYear(today));
		case 'previous_year': {
			const previousYear = subYears(today, 1);
			return toRange(startOfYear(previousYear), endOfYear(previousYear));
		}
	}
}

export function isManualFilterActive(filter: ManualFilter): boolean {
	if (filter.blockIds.length === 0) {
		return false;
	}
	if (filter.kind === 'values') {
		return filter.values.length > 0;
	}
	const range = resolveDateRange(filter);
	return Boolean(range.from || range.to);
}

export function describeManualFilter(filter: ManualFilter): string {
	if (filter.kind === 'values') {
		if (filter.values.length === 0) {
			return 'Any value';
		}
		return filter.values.length <= 2 ? filter.values.join(', ') : `${filter.values.length} values`;
	}
	return formatDateRangeValue(resolveDateRange(filter));
}

export function formatDateRangeValue(range: DateRangeValue): string {
	const from = parseIsoDate(range.from);
	const to = parseIsoDate(range.to);
	if (!from && !to) {
		return 'Any date';
	}
	if (from && to) {
		return `${format(from, 'MMM d, yyyy')} – ${format(to, 'MMM d, yyyy')}`;
	}
	return from ? `From ${format(from, 'MMM d, yyyy')}` : `Until ${format(to as Date, 'MMM d, yyyy')}`;
}

export function filterBlockRows(
	block: StoryControlBlock,
	rows: Record<string, unknown>[],
	filters: ManualFilter[],
): Record<string, unknown>[] {
	const applicable = filters.filter((filter) => filter.blockIds.includes(block.id) && isManualFilterActive(filter));
	if (applicable.length === 0) {
		return rows;
	}
	return rows.filter((row) => applicable.every((filter) => rowMatchesFilter(row, filter)));
}

export function applyChartDisplaySettings(
	chart: ParsedChartBlock,
	settings: BlockDisplaySettings | undefined,
): ParsedChartBlock {
	if (!settings) {
		return chart;
	}
	return {
		...chart,
		chartType: settings.chartType ?? chart.chartType,
		xAxisKey: settings.xAxisKey ?? chart.xAxisKey,
		showDataLabels: settings.showDataLabels ?? chart.showDataLabels,
		series: settings.seriesKeys ? buildSeries(chart, settings.seriesKeys) : chart.series,
	};
}

export function hasDisplaySettings(settings: BlockDisplaySettings | undefined): boolean {
	return Boolean(settings && Object.values(settings).some((value) => value !== undefined));
}

export function formatChartCount(count: number): string {
	return `${count} ${pluralize('chart', count)}`;
}

export function humanizeColumnName(name: string): string {
	const spaced = name.replace(/[_-]+/g, ' ').trim();
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function getResultColumns(result: QueryDataMap[string]): string[] {
	return result.columns.length > 0 ? result.columns : Object.keys(result.data[0] ?? {});
}

function buildSeries(chart: ParsedChartBlock, seriesKeys: string[]): ParsedChartBlock['series'] {
	return seriesKeys.map((dataKey, index) => {
		const existing = chart.series.find((series) => series.data_key === dataKey);
		return (
			existing ?? {
				data_key: dataKey,
				color: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length],
				label: humanizeColumnName(dataKey),
			}
		);
	});
}

function rowMatchesFilter(row: Record<string, unknown>, filter: ManualFilter): boolean {
	if (!(filter.column in row)) {
		return true;
	}
	const value = row[filter.column];
	if (filter.kind === 'values') {
		return value !== null && value !== undefined && filter.values.includes(String(value));
	}
	const day = typeof value === 'string' ? value.slice(0, 10) : '';
	if (!day) {
		return false;
	}
	const range = resolveDateRange(filter);
	return (!range.from || day >= range.from) && (!range.to || day <= range.to);
}

function inferColumnKind(name: string, rows: Record<string, unknown>[], block: StoryControlBlock): StoryColumnKind {
	if (block.kind === 'chart' && block.chart.xAxisKey === name && block.chart.xAxisType === 'date') {
		return 'date';
	}
	const values = rows
		.slice(0, 50)
		.map((row) => row[name])
		.filter((value) => value !== null && value !== undefined);
	if (values.length === 0) {
		return 'category';
	}
	if (values.every((value) => typeof value === 'number')) {
		return 'number';
	}
	if (values.every((value) => typeof value === 'string' && ISO_DATE_PATTERN.test(value))) {
		return 'date';
	}
	return 'category';
}

function flattenSegments(segments: Segment[]): Segment[] {
	return segments.flatMap((segment) => (segment.type === 'grid' ? flattenSegments(segment.children) : [segment]));
}

function toControlBlock(segment: Segment): StoryControlBlock[] {
	if (segment.type === 'chart') {
		const { chart } = segment;
		return [{ id: getChartBlockId(chart), kind: 'chart', queryId: chart.queryId, title: chart.title, chart }];
	}
	if (segment.type === 'table') {
		const { table } = segment;
		return [{ id: getTableBlockId(table), kind: 'table', queryId: table.queryId, title: table.title, table }];
	}
	return [];
}

function toRange(from: Date, to: Date): DateRangeValue {
	return { from: format(from, DATE_FORMAT), to: format(to, DATE_FORMAT) };
}

function parseIsoDate(value: string): Date | undefined {
	if (!ISO_DATE_PATTERN.test(value)) {
		return undefined;
	}
	const [year, month, day] = value.slice(0, 10).split('-').map(Number);
	return new Date(year, month - 1, day);
}
