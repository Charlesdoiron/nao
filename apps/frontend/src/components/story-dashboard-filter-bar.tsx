import { format } from 'date-fns';
import { CalendarIcon, Check, ChevronDown, Ellipsis, FilterX, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';

import type { DashboardFilter, DatePresetId, DateRangeSelection } from '@/lib/story-dashboard-filters';
import type { StoryDashboardEdit } from '@/hooks/use-story-dashboard-edit';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NakedInput } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useStoryDashboardEditContext } from '@/contexts/story-dashboard-edit';
import {
	DATE_PRESETS,
	describeDashboardFilter,
	getDistinctValues,
	isDashboardFilterActive,
	resolveDatePreset,
} from '@/lib/story-dashboard-filters';
import { cn } from '@/lib/utils';

export function StoryDashboardFilterBar() {
	const dashboard = useStoryDashboardEditContext();

	if (!dashboard || (!dashboard.isEditing && dashboard.filters.length === 0)) {
		return null;
	}

	const hasActiveValues = dashboard.filters.some(isDashboardFilterActive);

	return (
		<div
			className={cn(
				'flex flex-wrap items-end gap-3 rounded-lg border p-3',
				dashboard.isEditing ? 'border-dashed bg-background' : 'bg-muted/20',
			)}
		>
			{dashboard.filters.map((filter) => (
				<DashboardFilterControl key={filter.id} filter={filter} dashboard={dashboard} />
			))}
			{dashboard.isEditing && (
				<Button
					variant='outline'
					size='sm'
					className='h-8 gap-1.5 border-dashed text-muted-foreground'
					onClick={() => dashboard.openFilterDialog({ presetBlockKeys: dashboard.selectedBlockKeys })}
				>
					<Plus className='size-3.5' />
					Add filter
				</Button>
			)}
			{dashboard.isEditing && dashboard.filters.length === 0 && (
				<span className='self-center text-xs text-muted-foreground'>
					Pick a column exposed by your charts to let viewers slice this story without asking nao.
				</span>
			)}
			{hasActiveValues && (
				<Button variant='ghost' size='sm' className='h-8 gap-1.5' onClick={dashboard.clearFilterValues}>
					<FilterX className='size-3.5' />
					Clear
				</Button>
			)}
		</div>
	);
}

function DashboardFilterControl({ filter, dashboard }: { filter: DashboardFilter; dashboard: StoryDashboardEdit }) {
	const targetCount = filter.targetBlockKeys.length;

	return (
		<div
			className='flex min-w-36 flex-col gap-1'
			onMouseEnter={() => dashboard.isEditing && dashboard.setHighlightedFilterId(filter.id)}
			onMouseLeave={() => dashboard.isEditing && dashboard.setHighlightedFilterId(null)}
		>
			<div className='flex items-center justify-between gap-1'>
				<span className='text-xs font-medium text-muted-foreground'>
					{filter.label}
					{dashboard.isEditing && (
						<span className='ml-1.5 font-normal text-muted-foreground/70'>
							· {targetCount} {targetCount === 1 ? 'block' : 'blocks'}
						</span>
					)}
				</span>
				{dashboard.isEditing && <FilterConfigMenu filter={filter} dashboard={dashboard} />}
			</div>
			{filter.type === 'date_range' ? (
				<DateRangeFilterControl
					value={filter.dateRange}
					onChange={(dateRange) => dashboard.updateFilter(filter.id, { dateRange })}
				/>
			) : (
				<ValuesFilterControl filter={filter} dashboard={dashboard} />
			)}
		</div>
	);
}

function FilterConfigMenu({ filter, dashboard }: { filter: DashboardFilter; dashboard: StoryDashboardEdit }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type='button'
					className='rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
					aria-label={`Configure ${filter.label}`}
				>
					<Ellipsis className='size-3' />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end'>
				<DropdownMenuItem onSelect={() => dashboard.openFilterDialog({ editingFilterId: filter.id })}>
					<Pencil />
					Edit column & targets
				</DropdownMenuItem>
				<DropdownMenuItem variant='destructive' onSelect={() => dashboard.removeFilter(filter.id)}>
					<Trash2 />
					Remove filter
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function DateRangeFilterControl({
	value,
	onChange,
}: {
	value: DateRangeSelection | null;
	onChange: (value: DateRangeSelection | null) => void;
}) {
	const selectedRange = toDateRange(value);
	const label = value
		? describeDashboardFilter({
				id: '',
				label: '',
				column: '',
				type: 'date_range',
				targetBlockKeys: [],
				values: [],
				dateRange: value,
			})
		: 'All time';

	const selectPreset = (preset: DatePresetId) => onChange({ preset, ...resolveDatePreset(preset) });

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant='outline'
					size='sm'
					className={cn(
						'h-8 min-w-44 justify-start bg-background font-normal',
						!value && 'text-muted-foreground',
					)}
				>
					<CalendarIcon className='size-3.5' />
					<span className='flex-1 text-left'>{label}</span>
					<ChevronDown className='size-3.5 opacity-50' />
				</Button>
			</PopoverTrigger>
			<PopoverContent className='flex w-auto overflow-hidden p-0' align='start'>
				<div className='flex w-40 flex-col gap-0.5 border-r p-2'>
					<span className='px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
						Quick ranges
					</span>
					<PresetButton isActive={!value} onClick={() => onChange(null)}>
						All time
					</PresetButton>
					{DATE_PRESETS.map((preset) => (
						<PresetButton
							key={preset.id}
							isActive={value?.preset === preset.id}
							onClick={() => selectPreset(preset.id)}
						>
							{preset.label}
						</PresetButton>
					))}
				</div>
				<Calendar
					key={value?.preset ?? 'custom'}
					mode='range'
					selected={selectedRange}
					onSelect={(range) => onChange(fromDateRange(range))}
					defaultMonth={selectedRange?.from}
					navLayout='after'
					numberOfMonths={1}
				/>
			</PopoverContent>
		</Popover>
	);
}

function PresetButton({
	isActive,
	onClick,
	children,
}: {
	isActive: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type='button'
			onClick={onClick}
			className={cn(
				'flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent',
				isActive && 'bg-accent font-medium',
			)}
		>
			{children}
			{isActive && <Check className='size-3.5' />}
		</button>
	);
}

function ValuesFilterControl({ filter, dashboard }: { filter: DashboardFilter; dashboard: StoryDashboardEdit }) {
	const [search, setSearch] = useState('');
	const options = useMemo(() => {
		const rowSets = dashboard.blocks
			.filter((block) => filter.targetBlockKeys.includes(block.key))
			.map((block) => dashboard.queryData?.[block.queryId]?.data ?? []);
		return getDistinctValues(rowSets, filter.column);
	}, [dashboard.blocks, dashboard.queryData, filter.column, filter.targetBlockKeys]);
	const visibleOptions = options.filter((option) => option.toLowerCase().includes(search.trim().toLowerCase()));

	const toggleValue = (option: string, checked: boolean) =>
		dashboard.updateFilter(filter.id, {
			values: checked ? [...filter.values, option] : filter.values.filter((value) => value !== option),
		});

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant='outline'
					size='sm'
					className={cn(
						'h-8 min-w-40 justify-between bg-background font-normal',
						filter.values.length === 0 && 'text-muted-foreground',
					)}
				>
					<span className='truncate'>{describeDashboardFilter(filter)}</span>
					<ChevronDown className='size-3.5 opacity-50' />
				</Button>
			</PopoverTrigger>
			<PopoverContent className='w-60 p-0' align='start'>
				<div className='flex items-center gap-2 border-b px-2.5'>
					<Search className='size-3.5 text-muted-foreground' />
					<NakedInput
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder={`Search ${filter.label.toLowerCase()}`}
						className='h-9 w-full text-sm'
					/>
				</div>
				<div className='max-h-64 overflow-auto p-1'>
					{visibleOptions.map((option) => {
						const checked = filter.values.includes(option);
						return (
							<label
								key={option}
								className='flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent'
							>
								<Checkbox
									checked={checked}
									onCheckedChange={(next) => toggleValue(option, next === true)}
								/>
								<span className='truncate'>{option}</span>
							</label>
						);
					})}
					{visibleOptions.length === 0 && (
						<div className='px-2 py-3 text-center text-xs text-muted-foreground'>No matching values</div>
					)}
				</div>
				<div className='flex items-center justify-between border-t px-2.5 py-1.5 text-[11px] text-muted-foreground'>
					<span>{options.length} values from chart data</span>
					{filter.values.length > 0 && (
						<button
							type='button'
							className='font-medium text-foreground hover:underline'
							onClick={() => dashboard.updateFilter(filter.id, { values: [] })}
						>
							Reset
						</button>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

function toDateRange(value: DateRangeSelection | null): DateRange | undefined {
	const from = parseIsoDay(value?.from);
	const to = parseIsoDay(value?.to);
	return from || to ? { from, to } : undefined;
}

function fromDateRange(range: DateRange | undefined): DateRangeSelection | null {
	if (!range?.from && !range?.to) {
		return null;
	}
	return {
		preset: null,
		from: range?.from ? format(range.from, 'yyyy-MM-dd') : '',
		to: range?.to ? format(range.to, 'yyyy-MM-dd') : '',
	};
}

function parseIsoDay(value: string | undefined): Date | undefined {
	if (!value) {
		return undefined;
	}
	const [year, month, day] = value.split('-').map(Number);
	return year && month && day ? new Date(year, month - 1, day) : undefined;
}
