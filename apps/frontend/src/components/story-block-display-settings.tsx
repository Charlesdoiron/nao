import type { ChartType } from '@nao/shared/chart-types';

import type { QueryDataMap } from '@/components/story-embeds';
import type { BlockDisplaySettings, StoryControlBlock, StoryControlColumn } from '@/lib/story-controls';
import { CHART_TYPE_OPTIONS } from '@/components/tool-calls/chart-type-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getResultColumns, humanizeColumnName } from '@/lib/story-controls';

const SIDEBAR_CHART_TYPES = new Set<ChartType>([
	'bar',
	'stacked_bar',
	'horizontal_bar',
	'line',
	'area',
	'stacked_area',
	'pie',
	'donut',
]);

interface StoryBlockDisplaySettingsProps {
	block: StoryControlBlock;
	columns: StoryControlColumn[];
	queryData: QueryDataMap | null;
	settings: BlockDisplaySettings | undefined;
	onChange: (settings: BlockDisplaySettings) => void;
}

export function StoryBlockDisplaySettings(props: StoryBlockDisplaySettingsProps) {
	const result = props.queryData?.[props.block.queryId];
	if (!result) {
		return <p className='text-xs text-muted-foreground'>Data isn't loaded for this block yet.</p>;
	}
	const resultColumns = getResultColumns(result);
	return props.block.kind === 'chart' ? (
		<ChartSettings {...props} block={props.block} resultColumns={resultColumns} />
	) : (
		<TableSettings {...props} resultColumns={resultColumns} />
	);
}

function ChartSettings({
	block,
	columns,
	settings,
	onChange,
	resultColumns,
}: StoryBlockDisplaySettingsProps & {
	block: Extract<StoryControlBlock, { kind: 'chart' }>;
	resultColumns: string[];
}) {
	const { chart } = block;
	const kindByName = new Map(columns.map((column) => [column.name, column.kind]));
	const metricColumns = resultColumns.filter((name) => kindByName.get(name) === 'number');
	const dimensionColumns = resultColumns.filter((name) => kindByName.get(name) !== 'number');
	const chartType = settings?.chartType ?? chart.chartType;
	const xAxisKey = settings?.xAxisKey ?? chart.xAxisKey;
	const seriesKeys = settings?.seriesKeys ?? chart.series.map((series) => series.data_key);
	const showDataLabels = settings?.showDataLabels ?? chart.showDataLabels ?? false;

	const toggleSeries = (dataKey: string, checked: boolean) => {
		const next = checked ? [...seriesKeys, dataKey] : seriesKeys.filter((key) => key !== dataKey);
		if (next.length > 0) {
			onChange({ seriesKeys: next });
		}
	};

	return (
		<div className='flex flex-col gap-3.5'>
			<SettingRow label='Chart type'>
				<Select value={chartType} onValueChange={(value) => onChange({ chartType: value })}>
					<SelectTrigger size='sm' className='h-8 w-36 bg-background'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{CHART_TYPE_OPTIONS.filter((option) => SIDEBAR_CHART_TYPES.has(option.value)).map(
							({ value, label, icon: Icon }) => (
								<SelectItem key={value} value={value}>
									<Icon className='size-3.5' />
									{label}
								</SelectItem>
							),
						)}
					</SelectContent>
				</Select>
			</SettingRow>

			<SettingRow label='Group by'>
				<Select
					value={xAxisKey}
					onValueChange={(value) => onChange({ xAxisKey: value })}
					disabled={dimensionColumns.length <= 1}
				>
					<SelectTrigger size='sm' className='h-8 w-36 bg-background'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{dimensionColumns.map((name) => (
							<SelectItem key={name} value={name}>
								{humanizeColumnName(name)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</SettingRow>

			<div className='flex flex-col gap-1.5'>
				<span className='text-xs font-medium text-muted-foreground'>Columns</span>
				<div className='flex flex-col'>
					{metricColumns.map((name) => (
						<ColumnCheckbox
							key={name}
							name={name}
							checked={seriesKeys.includes(name)}
							onCheckedChange={(checked) => toggleSeries(name, checked)}
						/>
					))}
				</div>
			</div>

			<SettingRow label='Data labels'>
				<Switch
					checked={showDataLabels}
					onCheckedChange={(checked) => onChange({ showDataLabels: checked })}
					aria-label='Show data labels'
				/>
			</SettingRow>
		</div>
	);
}

function TableSettings({
	settings,
	onChange,
	resultColumns,
}: StoryBlockDisplaySettingsProps & { resultColumns: string[] }) {
	const visibleColumns = settings?.visibleColumns ?? resultColumns;

	const toggleColumn = (name: string, checked: boolean) => {
		const next = checked
			? resultColumns.filter((column) => column === name || visibleColumns.includes(column))
			: visibleColumns.filter((column) => column !== name);
		if (next.length > 0) {
			onChange({ visibleColumns: next });
		}
	};

	return (
		<div className='flex flex-col gap-1.5'>
			<span className='text-xs font-medium text-muted-foreground'>Visible columns</span>
			<div className='flex flex-col'>
				{resultColumns.map((name) => (
					<ColumnCheckbox
						key={name}
						name={name}
						checked={visibleColumns.includes(name)}
						onCheckedChange={(checked) => toggleColumn(name, checked)}
					/>
				))}
			</div>
		</div>
	);
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className='flex items-center justify-between gap-3'>
			<span className='text-xs font-medium text-muted-foreground'>{label}</span>
			{children}
		</div>
	);
}

function ColumnCheckbox({
	name,
	checked,
	onCheckedChange,
}: {
	name: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<label className='-mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1 text-sm hover:bg-accent'>
			<Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
			<span className='truncate'>{humanizeColumnName(name)}</span>
		</label>
	);
}
