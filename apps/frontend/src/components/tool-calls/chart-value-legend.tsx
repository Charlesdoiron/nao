import type { SeriesValueSummary, SummaryPoint } from '@nao/shared/chart-label-summary';
import { cn } from '@/lib/utils';

interface LegendSeries {
	value: string;
	dataKey: string | number;
	color: string;
	isHidden: boolean;
}

interface ChartValueLegendProps {
	series: LegendSeries[];
	summaries: SeriesValueSummary[];
	categoryFormatter: (value: string) => string;
	onItemClick?: (dataKey: string) => void;
}

export function ChartValueLegend({ series, summaries, categoryFormatter, onItemClick }: ChartValueLegendProps) {
	return (
		<div className='flex w-full flex-col items-center gap-1.5 pt-2'>
			<div className='flex flex-wrap justify-center gap-x-6 gap-y-1.5 text-xs'>
				{series.map((item) => (
					<ChartValueLegendItem
						key={item.dataKey}
						item={item}
						summary={summaries.find((summary) => summary.dataKey === String(item.dataKey))}
						categoryFormatter={categoryFormatter}
						onClick={onItemClick ? () => onItemClick(String(item.dataKey)) : undefined}
					/>
				))}
			</div>
			<p className='text-[11px] text-muted-foreground/70'>
				Too many points to label. Hover the chart for exact values.
			</p>
		</div>
	);
}

function ChartValueLegendItem({
	item,
	summary,
	categoryFormatter,
	onClick,
}: {
	item: LegendSeries;
	summary?: SeriesValueSummary;
	categoryFormatter: (value: string) => string;
	onClick?: () => void;
}) {
	return (
		<button
			type='button'
			onClick={onClick}
			className={cn(
				'flex items-center gap-2 whitespace-nowrap text-muted-foreground select-none',
				onClick && 'cursor-pointer hover:text-foreground',
				item.isHidden && 'opacity-40',
			)}
		>
			<span className='size-2 shrink-0 rounded-[2px]' style={{ backgroundColor: item.color }} />
			<span className='font-medium text-foreground'>{item.value}</span>
			{summary && (
				<>
					<ValueStat label='Latest' point={summary.latest} categoryFormatter={categoryFormatter} />
					<ValueStat label='High' point={summary.high} categoryFormatter={categoryFormatter} />
					<ValueStat label='Low' point={summary.low} categoryFormatter={categoryFormatter} />
				</>
			)}
		</button>
	);
}

function ValueStat({
	label,
	point,
	categoryFormatter,
}: {
	label: string;
	point: SummaryPoint;
	categoryFormatter: (value: string) => string;
}) {
	return (
		<span className='flex items-baseline gap-1'>
			<span>{label}</span>
			<span className='font-medium tabular-nums text-foreground'>{point.text}</span>
			<span className='text-[10px] text-muted-foreground/70'>{categoryFormatter(String(point.category))}</span>
		</span>
	);
}
