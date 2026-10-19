import { formatDataLabel } from './chart-data-labels';
import { toFiniteNumber } from './chart-values';
import type * as displayChart from './tools/display-chart';

export interface SummaryPoint {
	category: unknown;
	value: number;
	text: string;
}

export interface SeriesValueSummary {
	dataKey: string;
	latest: SummaryPoint;
	high: SummaryPoint;
	low: SummaryPoint;
}

const LABEL_CHAR_WIDTH = 6.6;
const LABEL_SLOT_PADDING = 10;
/** In-plot rows labels can use before a chart counts as too dense: natural row plus one leader row. */
const LABEL_ROWS = 2;

/** True when every data label could not fit in the plot even with leader lines, so a value legend reads better. */
export function shouldSummarizeDataLabels(
	data: Record<string, unknown>[],
	series: displayChart.SeriesConfig[],
	plotWidth: number,
): boolean {
	if (plotWidth <= 0 || series.length === 0) {
		return false;
	}
	const labels = series.flatMap((item) =>
		data.flatMap((row) => {
			const text = formatDataLabel(row[item.data_key], item.value_format);
			return text ? [text] : [];
		}),
	);
	if (labels.length === 0) {
		return false;
	}
	const averageSlot =
		labels.reduce((total, text) => total + text.length * LABEL_CHAR_WIDTH, 0) / labels.length + LABEL_SLOT_PADDING;
	return labels.length > (plotWidth / averageSlot) * LABEL_ROWS;
}

export function summarizeSeriesValues(
	data: Record<string, unknown>[],
	series: displayChart.SeriesConfig[],
	xAxisKey: string,
): SeriesValueSummary[] {
	return series.flatMap((item) => {
		const points = data.flatMap((row) => {
			const value = toFiniteNumber(row[item.data_key]);
			return value == null
				? []
				: [{ category: row[xAxisKey], value, text: formatDataLabel(value, item.value_format) }];
		});
		if (points.length === 0) {
			return [];
		}
		return [
			{
				dataKey: item.data_key,
				latest: points[points.length - 1],
				high: points.reduce((best, point) => (point.value > best.value ? point : best)),
				low: points.reduce((best, point) => (point.value < best.value ? point : best)),
			},
		];
	});
}
