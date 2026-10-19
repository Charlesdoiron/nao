import { describe, expect, it } from 'vitest';

import {
	applyChartDisplaySettings,
	collectStoryBlocks,
	collectStoryColumns,
	filterBlockRows,
	getDistinctColumnValues,
	resolveDatePreset,
} from './story-controls';
import type { ManualFilter } from './story-controls';

const CODE = `<chart query_id="query_monthly" chart_type="line" x_axis_key="order_date" x_axis_type="date" series='[{"data_key":"revenue","color":"var(--chart-1)"}]' title="Monthly revenue" />

<grid cols="2">
<chart query_id="query_regions" chart_type="bar" x_axis_key="region" series='[{"data_key":"revenue","color":"var(--chart-2)"}]' title="Revenue by region" />
<table query_id="query_orders" title="Orders" />
</grid>`;

const QUERY_DATA = {
	query_monthly: {
		columns: ['order_date', 'revenue'],
		data: [
			{ order_date: '2026-08-01', revenue: 10 },
			{ order_date: '2026-09-01', revenue: 20 },
			{ order_date: '2026-10-01', revenue: 30 },
		],
	},
	query_regions: {
		columns: ['region', 'revenue'],
		data: [
			{ region: 'Europe', revenue: 5 },
			{ region: 'APAC', revenue: 3 },
		],
	},
	query_orders: {
		columns: ['order_date', 'region', 'revenue'],
		data: [
			{ order_date: '2026-09-12', region: 'Europe', revenue: 1 },
			{ order_date: '2026-10-02', region: 'Europe', revenue: 2 },
			{ order_date: '2026-10-05', region: 'APAC', revenue: 3 },
		],
	},
};

describe('story controls', () => {
	const blocks = collectStoryBlocks(CODE);

	it('collects charts and tables nested in grids', () => {
		expect(blocks.map((block) => block.title)).toEqual(['Monthly revenue', 'Revenue by region', 'Orders']);
	});

	it('infers column kinds and the blocks exposing each column', () => {
		const columns = collectStoryColumns(blocks, QUERY_DATA);
		const byName = Object.fromEntries(columns.map((column) => [column.name, column]));

		expect(byName.order_date.kind).toBe('date');
		expect(byName.order_date.blockIds).toHaveLength(2);
		expect(byName.region.kind).toBe('category');
		expect(byName.revenue.kind).toBe('number');
	});

	it('counts distinct values once per query', () => {
		expect(getDistinctColumnValues('region', blocks, QUERY_DATA)).toEqual([
			{ value: 'Europe', count: 3 },
			{ value: 'APAC', count: 2 },
		]);
	});

	it('resolves relative date presets', () => {
		const today = new Date(2026, 9, 19);

		expect(resolveDatePreset('last_month', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
		expect(resolveDatePreset('previous_year', today)).toEqual({ from: '2025-01-01', to: '2025-12-31' });
	});

	it('only filters rows of the blocks a filter applies to', () => {
		const ordersBlock = blocks[2];
		const regionsBlock = blocks[1];
		const filter: ManualFilter = {
			id: 'f1',
			column: 'region',
			kind: 'values',
			values: ['Europe'],
			blockIds: [ordersBlock.id],
		};

		expect(filterBlockRows(ordersBlock, QUERY_DATA.query_orders.data, [filter])).toHaveLength(2);
		expect(filterBlockRows(regionsBlock, QUERY_DATA.query_regions.data, [filter])).toHaveLength(2);
	});

	it('filters rows by a custom date range', () => {
		const filter: ManualFilter = {
			id: 'f2',
			column: 'order_date',
			kind: 'date',
			preset: 'custom',
			customRange: { from: '2026-10-01', to: '2026-10-31' },
			blockIds: [blocks[0].id],
		};

		expect(filterBlockRows(blocks[0], QUERY_DATA.query_monthly.data, [filter])).toEqual([
			{ order_date: '2026-10-01', revenue: 30 },
		]);
	});

	it('overrides chart type and adds new series with a palette color', () => {
		const block = blocks[0];
		if (block.kind !== 'chart') {
			throw new Error('Expected a chart block');
		}
		const chart = applyChartDisplaySettings(block.chart, { chartType: 'bar', seriesKeys: ['revenue', 'orders'] });

		expect(chart.chartType).toBe('bar');
		expect(chart.series.map((series) => series.data_key)).toEqual(['revenue', 'orders']);
		expect(chart.series[1].label).toBe('Orders');
	});
});
