import { Code, Ellipsis, Filter, Pencil, RotateCcw } from 'lucide-react';
import { formatColumnLabel } from '@nao/shared/story-table-utils';

import type { ChartSeriesCandidate, ChartViewOptions, TableViewOptions } from '@/lib/story-block-view-options';
import type { ManualFilter } from '@/lib/story-manual-filters';
import type { StoryChartViewMenuActions } from '@/components/side-panel/story-chart-embed';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SimpleTooltip } from '@/components/ui/tooltip';
import {
	CHART_VIEW_TYPES,
	DEFAULT_CHART_VIEW_OPTIONS,
	DEFAULT_TABLE_VIEW_OPTIONS,
	TABLE_PAGE_SIZES,
	isChartViewCustomized,
	isTableViewCustomized,
	toggleKey,
} from '@/lib/story-block-view-options';
import { describeFilterValue } from '@/lib/story-manual-filters';

export function StoryChartViewMenu({
	options,
	onChange,
	candidates,
	visibleSeriesKeys,
	chartType,
	showDataLabels,
	supportsChartType,
	actions,
}: {
	options: ChartViewOptions;
	onChange: (options: ChartViewOptions) => void;
	candidates: ChartSeriesCandidate[];
	visibleSeriesKeys: string[];
	chartType: string;
	showDataLabels: boolean;
	supportsChartType: boolean;
	actions: StoryChartViewMenuActions;
}) {
	const isCustomized = isChartViewCustomized(options);
	const { isQueryVisible, onViewQuery, onEditChart } = actions;

	return (
		<DropdownMenu>
			<ViewMenuTrigger label='Chart options' isCustomized={isCustomized} />
			<DropdownMenuContent align='end' className='w-56'>
				<DropdownMenuLabel className='text-xs text-muted-foreground'>Columns</DropdownMenuLabel>
				{candidates.map((candidate) => (
					<DropdownMenuCheckboxItem
						key={candidate.dataKey}
						className='text-xs'
						checked={visibleSeriesKeys.includes(candidate.dataKey)}
						disabled={visibleSeriesKeys.length === 1 && visibleSeriesKeys[0] === candidate.dataKey}
						onSelect={(event) => event.preventDefault()}
						onCheckedChange={(checked) =>
							onChange({
								...options,
								seriesKeys: toggleKey(visibleSeriesKeys, candidate.dataKey, checked === true),
							})
						}
					>
						{candidate.label}
					</DropdownMenuCheckboxItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuLabel className='text-xs text-muted-foreground'>Display</DropdownMenuLabel>
				{supportsChartType && (
					<DropdownMenuSub>
						<DropdownMenuSubTrigger className='text-xs'>
							Chart type
							<span className='ml-auto text-muted-foreground'>{getChartTypeLabel(chartType)}</span>
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>
							<DropdownMenuRadioGroup
								value={chartType}
								onValueChange={(value) => onChange({ ...options, chartType: value })}
							>
								{CHART_VIEW_TYPES.map((type) => (
									<DropdownMenuRadioItem key={type.id} value={type.id} className='text-xs'>
										{type.label}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				)}
				<DropdownMenuCheckboxItem
					className='text-xs'
					checked={showDataLabels}
					onSelect={(event) => event.preventDefault()}
					onCheckedChange={(checked) => onChange({ ...options, showDataLabels: checked === true })}
				>
					Data labels
				</DropdownMenuCheckboxItem>
				<DropdownMenuCheckboxItem
					className='text-xs'
					checked={options.showLegend}
					onSelect={(event) => event.preventDefault()}
					onCheckedChange={(checked) => onChange({ ...options, showLegend: checked === true })}
				>
					Legend
				</DropdownMenuCheckboxItem>
				<DropdownMenuCheckboxItem
					className='text-xs'
					checked={options.showGrid}
					onSelect={(event) => event.preventDefault()}
					onCheckedChange={(checked) => onChange({ ...options, showGrid: checked === true })}
				>
					Gridlines
				</DropdownMenuCheckboxItem>
				{(onViewQuery || onEditChart) && <DropdownMenuSeparator />}
				{onViewQuery && (
					<DropdownMenuItem className='text-xs' onSelect={onViewQuery}>
						<Code className='size-3.5' />
						{isQueryVisible ? 'Hide SQL' : 'View SQL'}
					</DropdownMenuItem>
				)}
				{onEditChart && (
					<DropdownMenuItem className='text-xs' onSelect={onEditChart}>
						<Pencil className='size-3.5' />
						Edit chart…
					</DropdownMenuItem>
				)}
				<ResetViewItem isCustomized={isCustomized} onReset={() => onChange(DEFAULT_CHART_VIEW_OPTIONS)} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function StoryTableViewMenu({
	options,
	onChange,
	columns,
}: {
	options: TableViewOptions;
	onChange: (options: TableViewOptions) => void;
	columns: string[];
}) {
	const isCustomized = isTableViewCustomized(options);
	const visibleCount = columns.length - options.hiddenColumns.length;

	return (
		<DropdownMenu>
			<ViewMenuTrigger label='Table options' isCustomized={isCustomized} />
			<DropdownMenuContent align='end' className='w-56'>
				<DropdownMenuLabel className='flex items-center justify-between text-xs text-muted-foreground'>
					Columns
					<span className='font-normal'>
						{visibleCount}/{columns.length}
					</span>
				</DropdownMenuLabel>
				<div className='max-h-56 overflow-y-auto'>
					{columns.map((column) => {
						const isVisible = !options.hiddenColumns.includes(column);
						return (
							<DropdownMenuCheckboxItem
								key={column}
								className='text-xs'
								checked={isVisible}
								disabled={isVisible && visibleCount === 1}
								onSelect={(event) => event.preventDefault()}
								onCheckedChange={(checked) =>
									onChange({
										...options,
										hiddenColumns: toggleKey(options.hiddenColumns, column, checked !== true),
									})
								}
							>
								{formatColumnLabel(column)}
							</DropdownMenuCheckboxItem>
						);
					})}
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuLabel className='text-xs text-muted-foreground'>Display</DropdownMenuLabel>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger className='text-xs'>
						Rows per page
						<span className='ml-auto text-muted-foreground'>{options.pageSize}</span>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuRadioGroup
							value={String(options.pageSize)}
							onValueChange={(value) => onChange({ ...options, pageSize: Number(value) })}
						>
							{TABLE_PAGE_SIZES.map((size) => (
								<DropdownMenuRadioItem key={size} value={String(size)} className='text-xs'>
									{size}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<ResetViewItem isCustomized={isCustomized} onReset={() => onChange(DEFAULT_TABLE_VIEW_OPTIONS)} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function ManualFilterBadge({ filters }: { filters: ManualFilter[] }) {
	if (filters.length === 0) {
		return null;
	}

	return (
		<SimpleTooltip
			content={
				<div className='flex flex-col gap-0.5'>
					{filters.map((filter) => (
						<span key={filter.id}>
							<span className='text-muted-foreground'>{filter.label}:</span> {describeFilterValue(filter)}
						</span>
					))}
				</div>
			}
		>
			<span className='inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 text-[11px] font-medium text-primary'>
				<Filter className='size-2.5' />
				{filters.length}
			</span>
		</SimpleTooltip>
	);
}

function ViewMenuTrigger({ label, isCustomized }: { label: string; isCustomized: boolean }) {
	return (
		<DropdownMenuTrigger asChild>
			<Button
				variant='ghost-muted'
				size='icon-xs'
				title={label}
				className='relative shrink-0 hover:rounded-full hover:bg-accent data-[state=open]:rounded-full data-[state=open]:bg-accent'
			>
				<Ellipsis className='size-3.5' />
				{isCustomized && <span className='absolute top-0.5 right-0.5 size-1.5 rounded-full bg-primary' />}
			</Button>
		</DropdownMenuTrigger>
	);
}

function ResetViewItem({ isCustomized, onReset }: { isCustomized: boolean; onReset: () => void }) {
	if (!isCustomized) {
		return null;
	}

	return (
		<>
			<DropdownMenuSeparator />
			<DropdownMenuItem className='text-xs' onSelect={onReset}>
				<RotateCcw className='size-3.5' />
				Reset to story defaults
			</DropdownMenuItem>
		</>
	);
}

function getChartTypeLabel(chartType: string): string {
	return CHART_VIEW_TYPES.find((type) => type.id === chartType)?.label ?? formatColumnLabel(chartType);
}
