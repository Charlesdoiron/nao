import { describe, expect, it } from 'vitest';
import { splitCodeIntoSegments } from '@nao/shared/story-segments';

import type { DashboardFilter } from '@/lib/story-dashboard-filters';
import {
	applyDashboardFilters,
	collectDashboardBlocks,
	getDashboardBlockKey,
	getDistinctValues,
	listFilterableColumns,
	resolveDatePreset,
} from '@/lib/story-dashboard-filters';

const QUERY_DATA = {
	q_monthly: {
		columns: ['month', 'revenue'],
		data: [
			{ month: '2026-08-01', revenue: 10 },
			{ month: '2026-09-01', revenue: 20 },
			{ month: '2026-10-01', revenue: 30 },
		],
	},
	q_channel: {
		columns: ['channel', 'revenue'],
		data: [
			{ channel: 'Email', revenue: 5 },
			{ channel: 'Social', revenue: 7 },
		],
	},
};

const CODE = `<grid cols="2">
<chart query_id="q_monthly" chart_type="line" x_axis_key="month" series='[{"data_key":"revenue"}]' title="Monthly" />
<chart query_id="q_channel" chart_type="bar" x_axis_key="channel" series='[{"data_key":"revenue"}]' title="Channels" />
</grid>
<table query_id="q_channel" title="Channel table" />`;

const MONTHLY_KEY = getDashboardBlockKey('chart', 'q_monthly', 'Monthly');
const CHANNEL_KEY = getDashboardBlockKey('chart', 'q_channel', 'Channels');

function buildFilter(overrides: Partial<DashboardFilter>): DashboardFilter {
	return {
		id: 'filter',
		label: 'Filter',
		column: 'month',
		type: 'date_range',
		targetBlockKeys: [MONTHLY_KEY],
		values: [],
		dateRange: null,
		...overrides,
	};
}

describe('story dashboard filters', () => {
	it('collects charts and tables from grids with their exposed columns', () => {
		const blocks = collectDashboardBlocks(splitCodeIntoSegments(CODE), QUERY_DATA);

		expect(blocks.map((block) => [block.kind, block.title, block.columns])).toEqual([
			['chart', 'Monthly', ['month', 'revenue']],
			['chart', 'Channels', ['channel', 'revenue']],
			['table', 'Channel table', ['channel', 'revenue']],
		]);
	});

	it('lists columns by kind with the blocks exposing them', () => {
		const blocks = collectDashboardBlocks(splitCodeIntoSegments(CODE), QUERY_DATA);
		const columns = listFilterableColumns(blocks, QUERY_DATA);

		expect(columns.map((column) => [column.name, column.kind, column.blockKeys.length])).toEqual([
			['month', 'date', 1],
			['channel', 'text', 2],
			['revenue', 'number', 3],
		]);
	});

	it('resolves date presets relative to today', () => {
		const today = new Date(2026, 9, 19);

		expect(resolveDatePreset('last_month', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
		expect(resolveDatePreset('last_3_months', today)).toEqual({ from: '2026-07-01', to: '2026-09-30' });
		expect(resolveDatePreset('previous_year', today)).toEqual({ from: '2025-01-01', to: '2025-12-31' });
	});

	it('filters only the targeted blocks', () => {
		const filter = buildFilter({ dateRange: { preset: 'last_month', from: '2026-09-01', to: '2026-09-30' } });

		expect(applyDashboardFilters(QUERY_DATA.q_monthly.data, MONTHLY_KEY, [filter])).toEqual([
			{ month: '2026-09-01', revenue: 20 },
		]);
		expect(applyDashboardFilters(QUERY_DATA.q_channel.data, CHANNEL_KEY, [filter])).toHaveLength(2);
	});

	it('filters values picked from the distinct values of the chart data', () => {
		const options = getDistinctValues([QUERY_DATA.q_channel.data], 'channel');
		const filter = buildFilter({
			column: 'channel',
			type: 'values',
			targetBlockKeys: [CHANNEL_KEY],
			values: [options[0]],
		});

		expect(options).toEqual(['Email', 'Social']);
		expect(applyDashboardFilters(QUERY_DATA.q_channel.data, CHANNEL_KEY, [filter])).toEqual([
			{ channel: 'Email', revenue: 5 },
		]);
	});
});
