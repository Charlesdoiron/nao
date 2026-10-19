import { describe, expect, it } from 'vitest';

import {
	applyManualFilters,
	describeFilterValue,
	discoverFilterFields,
	getDefaultTargets,
	getDistinctValues,
	getTargetCandidates,
	resolveDateRange,
	toDateKey,
} from './story-manual-filters';
import type { QueryDataMap } from '@/components/story-embeds';
import type { ManualFilter, StoryBlockRef } from './story-manual-filters';

const queryData: QueryDataMap = {
	daily: {
		columns: ['order_date', 'revenue'],
		data: [
			{ order_date: '2026-08-31', revenue: 10 },
			{ order_date: '2026-09-01', revenue: 20 },
			{ order_date: '2026-09-30', revenue: 30 },
			{ order_date: '2026-10-01', revenue: 40 },
		],
	},
	regions: {
		columns: ['region', 'revenue'],
		data: [
			{ region: 'EMEA', revenue: 1 },
			{ region: 'APAC', revenue: 2 },
			{ region: 'EMEA', revenue: 3 },
		],
	},
	monthly: {
		columns: ['month', 'region', 'revenue'],
		data: [
			{ month: '2026-09-01', region: 'EMEA', revenue: 5 },
			{ month: '2026-10-01', region: 'APAC', revenue: 6 },
		],
	},
};

const blocks: StoryBlockRef[] = [
	{ queryId: 'daily', title: 'Daily revenue', kind: 'chart' },
	{ queryId: 'regions', title: 'Revenue by region', kind: 'chart' },
	{ queryId: 'monthly', title: 'Monthly', kind: 'table' },
];

describe('discoverFilterFields', () => {
	it('exposes date and category columns but not measures', () => {
		const fields = discoverFilterFields(blocks, queryData);
		expect(fields.map((field) => `${field.kind}:${field.column}`)).toEqual([
			'date:month',
			'date:order_date',
			'category:region',
		]);
		expect(fields.find((field) => field.column === 'region')?.queryIds).toEqual(['regions', 'monthly']);
	});
});

describe('getTargetCandidates', () => {
	it('maps date filters onto any date column of a block', () => {
		expect(getTargetCandidates(queryData, 'monthly', { kind: 'date', column: 'order_date' })).toEqual(['month']);
	});

	it('maps category filters only onto a same-named column', () => {
		expect(getTargetCandidates(queryData, 'daily', { kind: 'category', column: 'region' })).toEqual([]);
	});
});

describe('applyManualFilters', () => {
	it('filters every targeted query and leaves the others untouched', () => {
		const field = discoverFilterFields(blocks, queryData).find((candidate) => candidate.column === 'order_date')!;
		const filter: ManualFilter = {
			id: 'date',
			column: 'order_date',
			label: 'Order Date',
			kind: 'date',
			range: { mode: 'custom', from: '2026-09-01', to: '2026-09-30' },
			targets: getDefaultTargets(field, blocks, queryData),
		};

		const filtered = applyManualFilters(queryData, [filter]);

		expect(filtered?.daily.data.map((row) => row.revenue)).toEqual([20, 30]);
		expect(filtered?.monthly.data.map((row) => row.revenue)).toEqual([5]);
		expect(filtered?.regions).toBe(queryData.regions);
	});

	it('supports excluding category values', () => {
		const filter: ManualFilter = {
			id: 'region',
			column: 'region',
			label: 'Region',
			kind: 'category',
			operator: 'is_not',
			values: ['EMEA'],
			targets: [{ queryId: 'regions', column: 'region' }],
		};

		expect(applyManualFilters(queryData, [filter])?.regions.data).toEqual([{ region: 'APAC', revenue: 2 }]);
		expect(describeFilterValue(filter)).toBe('not EMEA');
	});

	it('ignores category filters without selected values', () => {
		const filter: ManualFilter = {
			id: 'region',
			column: 'region',
			label: 'Region',
			kind: 'category',
			operator: 'is',
			values: [],
			targets: [{ queryId: 'regions', column: 'region' }],
		};

		expect(applyManualFilters(queryData, [filter])).toBe(queryData);
	});
});

describe('getDistinctValues', () => {
	it('counts values across targets, most frequent first', () => {
		expect(
			getDistinctValues(queryData, [
				{ queryId: 'regions', column: 'region' },
				{ queryId: 'monthly', column: 'region' },
			]),
		).toEqual([
			{ value: 'EMEA', count: 3 },
			{ value: 'APAC', count: 2 },
		]);
	});
});

describe('resolveDateRange', () => {
	const today = new Date(2026, 9, 19);

	it.each([
		['last_month', '2026-09-01', '2026-09-30'],
		['this_month', '2026-10-01', '2026-10-19'],
		['last_quarter', '2026-07-01', '2026-09-30'],
		['previous_year', '2025-01-01', '2025-12-31'],
	] as const)('resolves %s', (preset, from, to) => {
		const range = resolveDateRange({ mode: 'preset', preset }, today);
		expect([toDateKey(range.from), toDateKey(range.to)]).toEqual([from, to]);
	});
});
