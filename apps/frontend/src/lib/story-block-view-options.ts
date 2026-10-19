import { formatColumnLabel } from '@nao/shared/story-table-utils';
import type { ParsedChartBlock, ParsedChartSeries } from '@nao/shared/story-segments';

export const CHART_VIEW_TYPES = [
	{ id: 'line', label: 'Line' },
	{ id: 'area', label: 'Area' },
	{ id: 'bar', label: 'Bar' },
	{ id: 'stacked_bar', label: 'Stacked bar' },
	{ id: 'horizontal_bar', label: 'Horizontal bar' },
] as const;

export const TABLE_PAGE_SIZES = [10, 25, 50] as const;

export interface ChartViewOptions {
	seriesKeys: string[] | null;
	chartType: string | null;
	showDataLabels: boolean | null;
	showLegend: boolean;
	showGrid: boolean;
}

export interface TableViewOptions {
	hiddenColumns: string[];
	pageSize: number;
}

export const DEFAULT_CHART_VIEW_OPTIONS: ChartViewOptions = {
	seriesKeys: null,
	chartType: null,
	showDataLabels: null,
	showLegend: true,
	showGrid: true,
};

export const DEFAULT_TABLE_VIEW_OPTIONS: TableViewOptions = {
	hiddenColumns: [],
	pageSize: TABLE_PAGE_SIZES[0],
};

export interface ChartSeriesCandidate {
	dataKey: string;
	label: string;
}

export function supportsChartViewOptions(chart: ParsedChartBlock): boolean {
	return CHART_VIEW_TYPES.some((type) => type.id === chart.chartType) || chart.chartType === 'stacked_area';
}

export function getChartSeriesCandidates(
	chart: ParsedChartBlock,
	data: Record<string, unknown>[],
	columns: string[],
): ChartSeriesCandidate[] {
	const configured = chart.series.map((series) => ({
		dataKey: series.data_key,
		label: series.label || formatColumnLabel(series.data_key),
	}));
	const configuredKeys = new Set(configured.map((series) => series.dataKey));
	const extra = columns
		.filter((column) => column !== chart.xAxisKey && !configuredKeys.has(column) && isNumericColumn(data, column))
		.map((column) => ({ dataKey: column, label: formatColumnLabel(column) }));
	return [...configured, ...extra];
}

export function getVisibleSeriesKeys(chart: ParsedChartBlock, options: ChartViewOptions): string[] {
	return options.seriesKeys ?? chart.series.map((series) => series.data_key);
}

export function applyChartViewOptions(chart: ParsedChartBlock, options: ChartViewOptions): ParsedChartBlock {
	const seriesKeys = getVisibleSeriesKeys(chart, options);
	return {
		...chart,
		chartType: options.chartType ?? chart.chartType,
		showDataLabels: options.showDataLabels ?? chart.showDataLabels,
		series: seriesKeys.map((dataKey, index) => findOrCreateSeries(chart.series, dataKey, index)),
	};
}

export function isChartViewCustomized(options: ChartViewOptions): boolean {
	return (
		options.seriesKeys !== null ||
		options.chartType !== null ||
		options.showDataLabels !== null ||
		!options.showLegend ||
		!options.showGrid
	);
}

export function isTableViewCustomized(options: TableViewOptions): boolean {
	return options.hiddenColumns.length > 0 || options.pageSize !== DEFAULT_TABLE_VIEW_OPTIONS.pageSize;
}

export function toggleKey(keys: string[], key: string, enabled: boolean): string[] {
	return enabled ? [...keys, key] : keys.filter((candidate) => candidate !== key);
}

function findOrCreateSeries(series: ParsedChartSeries[], dataKey: string, index: number): ParsedChartSeries {
	return (
		series.find((candidate) => candidate.data_key === dataKey) ?? {
			data_key: dataKey,
			label: formatColumnLabel(dataKey),
			color: `var(--chart-${(index % 5) + 1})`,
		}
	);
}

function isNumericColumn(data: Record<string, unknown>[], column: string): boolean {
	const values = data.map((row) => row[column]).filter((value) => value !== null && value !== undefined);
	return values.length > 0 && values.every((value) => typeof value === 'number');
}
