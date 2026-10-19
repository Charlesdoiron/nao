import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { buildChart } from '../src/chart-builder';
import { boxesOverlap, type LabelScene, type PlaceableLabel, placeLabels } from '../src/chart-label-placement';
import { shouldSummarizeDataLabels, summarizeSeriesValues } from '../src/chart-label-summary';

const BOUNDS = { left: 0, right: 400, top: 0, bottom: 300 };

function label(overrides: Partial<PlaceableLabel> = {}): PlaceableLabel {
	const anchor = overrides.anchor ?? { x: 100, y: 200 };
	return {
		anchor,
		natural: { left: anchor.x - 15, right: anchor.x + 15, top: anchor.y - 23, bottom: anchor.y - 8 },
		width: 30,
		height: 15,
		seriesIndex: 0,
		canMoveOutside: true,
		...overrides,
	};
}

function scene(overrides: Partial<LabelScene> = {}): LabelScene {
	return { bounds: BOUNDS, marks: [], strokes: [], ...overrides };
}

describe('placeLabels', () => {
	it('keeps a label at its natural spot when nothing is in the way', () => {
		const natural = label();
		const [placed] = placeLabels([natural], scene());

		expect(placed.box).toBe(natural.natural);
		expect(placed.leader).toBeUndefined();
	});

	it('moves a label off a bar and connects it with a leader', () => {
		const bar = { left: 60, right: 140, top: 100, bottom: 300 };
		const [placed] = placeLabels([label()], scene({ marks: [bar] }));

		expect(placed).toBeDefined();
		expect(boxesOverlap(placed.box, bar)).toBe(false);
		expect(placed.leader?.to.y).toBeLessThanOrEqual(placed.box.bottom);
		expect(placed.leader?.from.y).toBeGreaterThan(placed.box.bottom);
	});

	it('moves a label that sits on another series line', () => {
		const stroke = { from: { x: 60, y: 185 }, to: { x: 140, y: 185 }, seriesIndex: 1 };
		const [placed] = placeLabels([label()], scene({ strokes: [stroke] }));

		expect(placed.leader).toBeDefined();
	});

	it('stacks a colliding bar label within its own column without a leader', () => {
		const point = label({ anchor: { x: 100, y: 120 } });
		const bar = label({ anchor: { x: 100, y: 124 }, column: { left: 70, right: 130 } });
		const placements = placeLabels([point, bar], scene());

		expect(placements).toHaveLength(2);
		expect(placements[1].leader).toBeUndefined();
		expect(boxesOverlap(placements[0].box, placements[1].box)).toBe(false);
		expect(placements[1].box.bottom).toBeLessThanOrEqual(placements[0].box.top);
	});

	it('never overlaps placed labels or crosses their leaders', () => {
		const bar = { left: 0, right: 400, top: 60, bottom: 300 };
		const labels = [80, 120, 160, 200, 240].map((x) => label({ anchor: { x, y: 200 } }));
		const placements = placeLabels(labels, scene({ marks: [bar] }));

		expect(placements.length).toBeGreaterThan(0);
		for (const [index, a] of placements.entries()) {
			expect(boxesOverlap(a.box, bar)).toBe(false);
			for (const b of placements.slice(index + 1)) {
				expect(boxesOverlap(a.box, b.box)).toBe(false);
			}
		}
	});

	it('drops a label when no free spot exists', () => {
		const everything = { left: 0, right: 400, top: 0, bottom: 300 };
		expect(placeLabels([label()], scene({ marks: [everything] }))).toEqual([]);
	});
});

describe('combo chart data labels', () => {
	const issueChart = buildChart({
		data: [
			{ quarter: 'Q1 2025', revenue: 1_820_000, growth: 11.2 },
			{ quarter: 'Q2 2025', revenue: 1_790_000, growth: -0.5 },
			{ quarter: 'Q3 2025', revenue: 1_910_000, growth: 8.5 },
			{ quarter: 'Q4 2025', revenue: 1_960_000, growth: 14.7 },
			{ quarter: 'Q1 2026', revenue: 1_880_000, growth: 6.2 },
		],
		chartType: 'mixed',
		xAxisKey: 'quarter',
		xAxisType: 'category',
		series: [
			{ data_key: 'revenue', series_type: 'bar', value_format: { d3_format: '.2s', prefix: '$' } },
			{
				data_key: 'growth',
				series_type: 'line',
				y_axis: 'right',
				value_format: { d3_format: '.1f', suffix: '%' },
			},
		],
		showDataLabels: true,
		margin: { top: 0, right: 0, bottom: 0, left: 0 },
	});

	it('keeps every line label off the bars, using leaders where needed', () => {
		const html = renderToString(React.cloneElement(issueChart, { width: 506, height: 225 }));
		const bars = [...html.matchAll(/<path[^>]*class="recharts-rectangle"[^>]*d="M([\d.]+),([\d.]+)/g)].map(
			(match) => ({ left: Number(match[1]), top: Number(match[2]) }),
		);
		const labels = parseLabels(html);

		expect(labels.map((entry) => entry.text).sort()).toEqual(
			['$1.8M', '$1.8M', '$1.9M', '$1.9M', '$2.0M', '-0.5%', '11.2%', '14.7%', '6.2%', '8.5%'].sort(),
		);
		for (const entry of labels.filter((item) => item.text.endsWith('%'))) {
			const bar = bars.find((item) => entry.x >= item.left && entry.x <= item.left + 60);
			if (bar) {
				expect(entry.y).toBeLessThanOrEqual(bar.top);
			}
		}
		expect(html).toContain('recharts-data-label-leaders');
	});
});

describe('data label summary', () => {
	const daily = Array.from({ length: 60 }, (_, index) => ({ day: `D${index + 1}`, users: 4_000 + index * 10 }));

	it('summarizes labels that cannot fit in the plot', () => {
		expect(shouldSummarizeDataLabels(daily, [{ data_key: 'users' }], 500)).toBe(true);
		expect(shouldSummarizeDataLabels(daily.slice(0, 6), [{ data_key: 'users' }], 500)).toBe(false);
	});

	it('reports latest, high and low values per series', () => {
		const [summary] = summarizeSeriesValues(daily, [{ data_key: 'users' }], 'day');

		expect(summary.latest).toMatchObject({ category: 'D60', value: 4_590 });
		expect(summary.high.value).toBe(4_590);
		expect(summary.low).toMatchObject({ category: 'D1', value: 4_000 });
	});
});

function parseLabels(html: string) {
	const group = html.match(/<g class="recharts-data-labels">(.*?)<\/g>/s)?.[1] ?? '';
	return [...group.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>([^<]*)<\/text>/g)].map((match) => ({
		x: Number(match[1]),
		y: Number(match[2]),
		text: match[3],
	}));
}
