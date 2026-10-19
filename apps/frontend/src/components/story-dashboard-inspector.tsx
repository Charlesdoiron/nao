import { ChartColumn, RotateCcw, Table2, X } from 'lucide-react';
import type { ChartType } from '@nao/shared/chart-types';
import type { ParsedChartBlock } from '@nao/shared/story-segments';

import type { DashboardBlock } from '@/lib/story-dashboard-filters';
import type { BlockDisplayOverride, StoryDashboardEdit } from '@/hooks/use-story-dashboard-edit';
import { COLUMN_KIND_ICONS } from '@/components/story-dashboard-block';
import { ChartTypePicker } from '@/components/tool-calls/chart-type-picker';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { detectColumnKind } from '@/lib/story-dashboard-filters';

export function StoryDashboardInspector({ dashboard }: { dashboard: StoryDashboardEdit }) {
	const block = dashboard.blocks.find((candidate) => candidate.key === dashboard.inspectedBlockKey);
	if (!dashboard.isEditing || !block) {
		return null;
	}

	const override = dashboard.overrides[block.key] ?? {};
	const hasOverride = Object.keys(override).length > 0;
	const KindIcon = block.kind === 'chart' ? ChartColumn : Table2;

	return (
		<aside className='flex w-80 shrink-0 flex-col border-l bg-background'>
			<div className='flex items-center gap-2 border-b px-4 py-3'>
				<KindIcon className='size-4 text-muted-foreground' />
				<div className='min-w-0 flex-1'>
					<div className='text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
						{block.kind === 'chart' ? 'Chart display' : 'Table columns'}
					</div>
					<div className='truncate text-sm font-medium'>{override.title ?? block.title}</div>
				</div>
				<Button
					variant='ghost'
					size='icon-sm'
					className='hover:rounded-full'
					aria-label='Close inspector'
					onClick={() => dashboard.inspectBlock(null)}
				>
					<X className='size-3.5' />
				</Button>
			</div>

			<div className='flex-1 overflow-auto'>
				{block.kind === 'chart' && block.chart ? (
					<ChartInspectorFields
						block={block}
						chart={block.chart}
						override={override}
						rows={dashboard.queryData?.[block.queryId]?.data ?? []}
						onChange={(patch) => dashboard.updateOverride(block.key, patch)}
					/>
				) : (
					<TableInspectorFields
						block={block}
						hiddenColumns={override.hiddenColumns ?? []}
						onChange={(hiddenColumns) => dashboard.updateOverride(block.key, { hiddenColumns })}
					/>
				)}
			</div>

			<div className='flex items-center justify-between gap-2 border-t px-4 py-3'>
				<span className='text-[11px] text-muted-foreground'>
					{hasOverride ? 'Edited from the story defaults' : 'Using the story defaults'}
				</span>
				<Button
					variant='ghost'
					size='sm'
					className='gap-1.5'
					disabled={!hasOverride}
					onClick={() => dashboard.resetOverride(block.key)}
				>
					<RotateCcw className='size-3' />
					Reset
				</Button>
			</div>
		</aside>
	);
}

function ChartInspectorFields({
	block,
	chart,
	override,
	rows,
	onChange,
}: {
	block: DashboardBlock;
	chart: ParsedChartBlock;
	override: BlockDisplayOverride;
	rows: Record<string, unknown>[];
	onChange: (patch: BlockDisplayOverride) => void;
}) {
	const effective = { ...chart, ...override };
	const metricColumns = block.columns.filter((column) => detectColumnKind(rows, column) === 'number');
	const dimensionColumns = block.columns.filter((column) => detectColumnKind(rows, column) !== 'number');
	const activeSeriesKeys = new Set(effective.series.map((series) => series.data_key));
	const isKpi = effective.chartType === 'kpi_card';

	const toggleSeries = (column: string, checked: boolean) => {
		const nextSeries = checked
			? [...effective.series, chart.series.find((series) => series.data_key === column) ?? { data_key: column }]
			: effective.series.filter((series) => series.data_key !== column);
		if (nextSeries.length > 0) {
			onChange({ series: nextSeries });
		}
	};

	return (
		<div className='flex flex-col'>
			<InspectorSection title='Title'>
				<Input
					value={effective.title}
					onChange={(event) => onChange({ title: event.target.value })}
					className='h-8'
				/>
			</InspectorSection>

			<InspectorSection title='Visualization'>
				<ChartTypePicker
					value={effective.chartType as ChartType}
					onValueChange={(chartType) => onChange({ chartType })}
				/>
			</InspectorSection>

			{!isKpi && (
				<InspectorSection title='X axis'>
					<Select value={effective.xAxisKey} onValueChange={(xAxisKey) => onChange({ xAxisKey })}>
						<SelectTrigger className='h-8 w-full'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{dimensionColumns.map((column) => (
								<SelectItem key={column} value={column}>
									<span className='font-mono text-xs'>{column}</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</InspectorSection>
			)}

			<InspectorSection title='Columns shown' hint='Pick which metrics from the query are plotted.'>
				<div className='flex flex-col gap-0.5'>
					{metricColumns.map((column) => {
						const Icon = COLUMN_KIND_ICONS.number;
						const isActive = activeSeriesKeys.has(column);
						return (
							<label
								key={column}
								className='flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent'
							>
								<Checkbox
									checked={isActive}
									disabled={isActive && activeSeriesKeys.size === 1}
									onCheckedChange={(checked) => toggleSeries(column, checked === true)}
								/>
								<Icon className='size-3 text-muted-foreground' />
								<span className='font-mono text-xs'>{column}</span>
							</label>
						);
					})}
				</div>
			</InspectorSection>

			<InspectorSection title='Display options'>
				<div className='flex flex-col gap-3'>
					<ToggleRow
						label='Data labels'
						checked={Boolean(effective.showDataLabels)}
						onCheckedChange={(showDataLabels) => onChange({ showDataLabels })}
					/>
					<ToggleRow
						label='Show total in tooltip'
						checked={!effective.hideTotal}
						onCheckedChange={(checked) => onChange({ hideTotal: !checked })}
					/>
				</div>
			</InspectorSection>
		</div>
	);
}

function TableInspectorFields({
	block,
	hiddenColumns,
	onChange,
}: {
	block: DashboardBlock;
	hiddenColumns: string[];
	onChange: (hiddenColumns: string[]) => void;
}) {
	const visibleCount = block.columns.length - hiddenColumns.length;
	return (
		<InspectorSection title='Visible columns' hint={`${visibleCount} of ${block.columns.length} columns shown.`}>
			<div className='flex flex-col gap-0.5'>
				{block.columns.map((column) => {
					const isVisible = !hiddenColumns.includes(column);
					return (
						<label
							key={column}
							className='flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent'
						>
							<Checkbox
								checked={isVisible}
								disabled={isVisible && visibleCount === 1}
								onCheckedChange={(checked) =>
									onChange(
										checked === true
											? hiddenColumns.filter((hidden) => hidden !== column)
											: [...hiddenColumns, column],
									)
								}
							/>
							<span className='font-mono text-xs'>{column}</span>
						</label>
					);
				})}
			</div>
		</InspectorSection>
	);
}

function InspectorSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
	return (
		<section className='flex flex-col gap-2 border-b px-4 py-3.5'>
			<div className='flex flex-col gap-0.5'>
				<span className='text-xs font-medium'>{title}</span>
				{hint && <span className='text-[11px] text-muted-foreground'>{hint}</span>}
			</div>
			{children}
		</section>
	);
}

function ToggleRow({
	label,
	checked,
	onCheckedChange,
}: {
	label: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<div className='flex items-center justify-between gap-2'>
			<span className='text-sm'>{label}</span>
			<Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
		</div>
	);
}
