import { createFileRoute } from '@tanstack/react-router';
import { useLayoutEffect } from 'react';
import type { displayChart } from '@nao/shared/tools';
import type { ChartType } from '@nao/shared/chart-types';

import { ChartDisplay } from '@/components/tool-calls/display-chart';

export const Route = createFileRoute('/embed/chart-labels-preview')({
	validateSearch: (search: Record<string, unknown>): { theme: PreviewTheme } => ({
		theme: search.theme === 'dark' ? 'dark' : 'light',
	}),
	component: ChartLabelsPreviewPage,
});

type PreviewTheme = 'light' | 'dark';

interface PreviewChart {
	title: string;
	chartType: ChartType;
	xAxisKey: string;
	series: displayChart.SeriesConfig[];
	data: Record<string, unknown>[];
}

const PERCENT_FORMAT: displayChart.ValueFormat = { d3_format: '.1f', suffix: '%' };
const CURRENCY_FORMAT: displayChart.ValueFormat = { d3_format: ',.0f', prefix: '$', compact: 'financial' };

const PREVIEW_CHARTS: PreviewChart[] = [
	{
		title: 'Revenue and growth rate by quarter',
		chartType: 'mixed',
		xAxisKey: 'quarter',
		series: [
			{ data_key: 'revenue', color: '#4c2ff2', series_type: 'bar', value_format: CURRENCY_FORMAT },
			{
				data_key: 'growth',
				color: '#52b788',
				series_type: 'line',
				y_axis: 'right',
				value_format: PERCENT_FORMAT,
			},
		],
		data: [
			{ quarter: 'Q1 2025', revenue: 1_820_000, growth: 12.1 },
			{ quarter: 'Q2 2025', revenue: 1_810_000, growth: -0.5 },
			{ quarter: 'Q3 2025', revenue: 1_960_000, growth: 8.5 },
			{ quarter: 'Q4 2025', revenue: 2_250_000, growth: 14.7 },
			{ quarter: 'Q1 2026', revenue: 2_390_000, growth: 6.2 },
		],
	},
	{
		title: 'Orders and conversion rate by channel',
		chartType: 'mixed',
		xAxisKey: 'channel',
		series: [
			{ data_key: 'orders', color: '#f5c518', series_type: 'bar' },
			{
				data_key: 'conversion',
				color: '#e5484d',
				series_type: 'line',
				y_axis: 'right',
				value_format: PERCENT_FORMAT,
			},
		],
		data: [
			{ channel: 'Organic', orders: 4200, conversion: 3.4 },
			{ channel: 'Paid search', orders: 3900, conversion: 2.1 },
			{ channel: 'Email', orders: 2600, conversion: 4.8 },
			{ channel: 'Social', orders: 3100, conversion: 1.6 },
			{ channel: 'Referral', orders: 3700, conversion: 3.9 },
		],
	},
	{
		title: 'Weekly active users by platform',
		chartType: 'line',
		xAxisKey: 'week',
		series: [
			{ data_key: 'web', color: '#2563eb' },
			{ data_key: 'ios', color: '#0f172a' },
			{ data_key: 'android', color: '#16a34a' },
		],
		data: [
			{ week: 'W1', web: 820, ios: 760, android: 610 },
			{ week: 'W2', web: 780, ios: 800, android: 690 },
			{ week: 'W3', web: 860, ios: 770, android: 820 },
			{ week: 'W4', web: 910, ios: 880, android: 790 },
			{ week: 'W5', web: 870, ios: 940, android: 900 },
			{ week: 'W6', web: 960, ios: 900, android: 950 },
		],
	},
	{
		title: 'Net cash flow and margin',
		chartType: 'mixed',
		xAxisKey: 'month',
		series: [
			{ data_key: 'cash_flow', color: '#0f766e', series_type: 'bar', value_format: CURRENCY_FORMAT },
			{
				data_key: 'margin',
				color: '#f97316',
				series_type: 'line',
				y_axis: 'right',
				value_format: PERCENT_FORMAT,
			},
		],
		data: [
			{ month: 'Jan', cash_flow: 120_000, margin: 9.2 },
			{ month: 'Feb', cash_flow: -45_000, margin: -2.4 },
			{ month: 'Mar', cash_flow: 80_000, margin: 4.1 },
			{ month: 'Apr', cash_flow: -20_000, margin: 0.8 },
			{ month: 'May', cash_flow: 150_000, margin: 11.3 },
			{ month: 'Jun', cash_flow: 95_000, margin: 7.6 },
		],
	},
];

function ChartLabelsPreviewPage() {
	const { theme } = Route.useSearch();
	useDocumentTheme(theme);

	return (
		<div className='min-h-screen bg-background p-8 text-foreground'>
			<h1 className='mb-6 text-lg font-semibold'>Chart data labels preview</h1>
			<div className='grid grid-cols-2 gap-6'>
				{PREVIEW_CHARTS.map((chart) => (
					<div key={chart.title} className='rounded-xl border bg-panel p-4'>
						<ChartDisplay
							data={chart.data}
							chartType={chart.chartType}
							xAxisKey={chart.xAxisKey}
							xAxisType='category'
							series={chart.series}
							title={chart.title}
							showDataLabels
							disableTooltip
						/>
					</div>
				))}
			</div>
		</div>
	);
}

function useDocumentTheme(theme: PreviewTheme) {
	useLayoutEffect(() => {
		const root = document.documentElement;
		root.classList.toggle('dark', theme === 'dark');
		return () => {
			root.classList.remove('dark');
		};
	}, [theme]);
}
