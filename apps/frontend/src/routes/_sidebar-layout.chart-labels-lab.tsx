import { createFileRoute } from '@tanstack/react-router';

import type { displayChart } from '@nao/shared/tools';
import type { ChartType } from '@nao/shared/chart-types';
import { ChartDisplay } from '@/components/tool-calls/display-chart';

export const Route = createFileRoute('/_sidebar-layout/chart-labels-lab')({
	component: ChartLabelsLab,
});

interface LabScenario {
	id: string;
	title: string;
	caption: string;
	chartType: ChartType;
	xAxisKey: string;
	series: displayChart.SeriesConfig[];
	data: Record<string, unknown>[];
}

const PERCENT_FORMAT = { d3_format: '.1f', suffix: '%' };
const CURRENCY_FORMAT = { d3_format: '.2s', prefix: '$', compact: 'financial' as const };

const SCENARIOS: LabScenario[] = [
	{
		id: 'combo',
		title: 'Revenue and growth by quarter',
		caption: 'Issue #1972: growth labels land on top of tall revenue bars.',
		chartType: 'mixed',
		xAxisKey: 'quarter',
		series: [
			{
				data_key: 'revenue',
				label: 'Revenue',
				series_type: 'bar',
				color: '#4b2ef5',
				value_format: CURRENCY_FORMAT,
			},
			{
				data_key: 'growth',
				label: 'Growth',
				series_type: 'line',
				y_axis: 'right',
				color: '#4fb57a',
				value_format: PERCENT_FORMAT,
			},
		],
		data: [
			{ quarter: 'Q1 2025', revenue: 1_820_000, growth: 11.2 },
			{ quarter: 'Q2 2025', revenue: 1_790_000, growth: -0.5 },
			{ quarter: 'Q3 2025', revenue: 1_910_000, growth: 8.5 },
			{ quarter: 'Q4 2025', revenue: 1_960_000, growth: 14.7 },
			{ quarter: 'Q1 2026', revenue: 1_880_000, growth: 6.2 },
		],
	},
	{
		id: 'grouped-bars',
		title: 'Orders by region',
		caption: 'Neighbouring bars with close values: labels collide and get dropped.',
		chartType: 'bar',
		xAxisKey: 'region',
		series: [
			{ data_key: 'online', label: 'Online' },
			{ data_key: 'retail', label: 'Retail' },
			{ data_key: 'partner', label: 'Partner' },
		],
		data: [
			{ region: 'North', online: 12_480, retail: 12_310, partner: 4_150 },
			{ region: 'South', online: 9_870, retail: 10_020, partner: 9_910 },
			{ region: 'East', online: 15_240, retail: 6_480, partner: 15_120 },
			{ region: 'West', online: 7_350, retail: 7_290, partner: 7_410 },
			{ region: 'Central', online: 11_060, retail: 3_220, partner: 10_940 },
		],
	},
	{
		id: 'crossing-lines',
		title: 'Conversion rate by channel',
		caption: 'Lines that cross and cluster: labels sit on other lines or vanish.',
		chartType: 'line',
		xAxisKey: 'month',
		series: [
			{ data_key: 'search', label: 'Search', value_format: PERCENT_FORMAT },
			{ data_key: 'social', label: 'Social', value_format: PERCENT_FORMAT },
			{ data_key: 'email', label: 'Email', value_format: PERCENT_FORMAT },
		],
		data: [
			{ month: 'Jan', search: 3.2, social: 2.1, email: 3.4 },
			{ month: 'Feb', search: 3.4, social: 2.6, email: 3.3 },
			{ month: 'Mar', search: 3.1, social: 3.2, email: 3.0 },
			{ month: 'Apr', search: 3.6, social: 3.5, email: 3.7 },
			{ month: 'May', search: 3.9, social: 3.0, email: 3.8 },
			{ month: 'Jun', search: 4.1, social: 3.9, email: 4.0 },
			{ month: 'Jul', search: 3.8, social: 4.2, email: 3.9 },
		],
	},
	{
		id: 'dense',
		title: 'Daily active users vs. signups (60 days)',
		caption: 'Too many points to label individually.',
		chartType: 'mixed',
		xAxisKey: 'day',
		series: [
			{ data_key: 'active_users', label: 'Active users', series_type: 'bar' },
			{ data_key: 'signups', label: 'Signups', series_type: 'line', y_axis: 'right' },
		],
		data: buildDailySeries(60),
	},
];

function ChartLabelsLab() {
	return (
		<div className='flex min-h-0 flex-1 flex-col overflow-y-auto bg-background'>
			<div className='mx-auto flex w-full max-w-6xl flex-col gap-6 px-8 py-8'>
				<div className='flex flex-col gap-1'>
					<h1 className='text-xl font-semibold text-foreground'>Chart labels lab</h1>
					<p className='text-sm text-muted-foreground'>
						Mocked charts with data labels enabled, used to compare label placement strategies.
					</p>
				</div>
				<div className='grid grid-cols-1 gap-6 xl:grid-cols-2'>
					{SCENARIOS.map((scenario) => (
						<LabScenarioCard key={scenario.id} scenario={scenario} />
					))}
				</div>
			</div>
		</div>
	);
}

function LabScenarioCard({ scenario }: { scenario: LabScenario }) {
	return (
		<section data-scenario={scenario.id} className='flex flex-col gap-2'>
			<p className='text-xs text-muted-foreground'>{scenario.caption}</p>
			<div className='flex aspect-3/2 flex-col gap-2 rounded-lg border border-border bg-backgroundSecondary/30 px-3 pb-2'>
				<div className='flex items-center py-2'>
					<span className='text-sm font-medium text-foreground'>{scenario.title}</span>
				</div>
				<ChartDisplay
					data={scenario.data}
					chartType={scenario.chartType}
					xAxisKey={scenario.xAxisKey}
					xAxisType='category'
					series={scenario.series}
					title={scenario.title}
					showDataLabels
				/>
			</div>
		</section>
	);
}

function buildDailySeries(days: number) {
	return Array.from({ length: days }, (_, index) => {
		const date = new Date(Date.UTC(2026, 7, 1 + index));
		const weekday = date.getUTCDay();
		const weekendDip = weekday === 0 || weekday === 6 ? 0.78 : 1;
		const trend = 4_200 + index * 22;
		const wave = Math.sin(index / 4) * 260;
		return {
			day: date.toISOString().slice(5, 10),
			active_users: Math.round((trend + wave) * weekendDip),
			signups: Math.round((140 + Math.cos(index / 3) * 38 + index * 1.4) * weekendDip),
		};
	});
}
