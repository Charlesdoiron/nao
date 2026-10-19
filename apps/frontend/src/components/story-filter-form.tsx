import { ArrowLeft, CalendarIcon, ChartColumn, Search, Table2, Tag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';

import type { QueryDataMap } from '@/components/story-embeds';
import type {
	DatePresetId,
	DateRangeValue,
	ManualFilter,
	StoryControlBlock,
	StoryControlColumn,
} from '@/lib/story-controls';
import { StoryDatePresetChips } from '@/components/story-date-preset-chips';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
	formatChartCount,
	formatDateRangeValue,
	getDistinctColumnValues,
	getFilterableColumns,
	resolveDatePreset,
} from '@/lib/story-controls';
import { cn } from '@/lib/utils';

const DEFAULT_DATE_PRESET: DatePresetId = 'last_month';

interface StoryFilterFormProps {
	blocks: StoryControlBlock[];
	columns: StoryControlColumn[];
	queryData: QueryDataMap | null;
	initialFilter?: ManualFilter;
	onSave: (filter: ManualFilter) => void;
	onCancel: () => void;
	onPreviewChange: (filter: ManualFilter | null) => void;
}

export function StoryFilterForm({
	blocks,
	columns,
	queryData,
	initialFilter,
	onSave,
	onCancel,
	onPreviewChange,
}: StoryFilterFormProps) {
	const filterableColumns = useMemo(() => getFilterableColumns(columns), [columns]);
	const [columnName, setColumnName] = useState<string | null>(initialFilter?.column ?? null);
	const [values, setValues] = useState<string[]>(initialFilter?.kind === 'values' ? initialFilter.values : []);
	const [preset, setPreset] = useState<DatePresetId>(
		initialFilter?.kind === 'date' ? initialFilter.preset : DEFAULT_DATE_PRESET,
	);
	const [customRange, setCustomRange] = useState<DateRangeValue>(
		initialFilter?.kind === 'date' ? initialFilter.customRange : { from: '', to: '' },
	);
	const [blockIds, setBlockIds] = useState<string[]>(initialFilter?.blockIds ?? []);

	const [filterId] = useState(() => initialFilter?.id ?? crypto.randomUUID());

	const column = filterableColumns.find((candidate) => candidate.name === columnName) ?? null;
	const isDateColumn = column?.kind === 'date';
	const draftFilter = useMemo<ManualFilter | null>(() => {
		if (!column || blockIds.length === 0 || (!isDateColumn && values.length === 0)) {
			return null;
		}
		const base = { id: filterId, column: column.name, blockIds };
		return isDateColumn ? { ...base, kind: 'date', preset, customRange } : { ...base, kind: 'values', values };
	}, [column, blockIds, isDateColumn, values, filterId, preset, customRange]);

	useEffect(() => {
		onPreviewChange(draftFilter);
	}, [draftFilter, onPreviewChange]);

	useEffect(() => () => onPreviewChange(null), [onPreviewChange]);

	const handleColumnChange = (name: string) => {
		const nextColumn = filterableColumns.find((candidate) => candidate.name === name);
		setColumnName(name);
		setValues([]);
		setPreset(DEFAULT_DATE_PRESET);
		setBlockIds(nextColumn?.blockIds ?? []);
	};

	const handleSave = () => {
		if (draftFilter) {
			onSave(draftFilter);
		}
	};

	return (
		<div className='flex min-h-0 flex-1 flex-col'>
			<div className='flex items-center gap-2 border-b px-4 py-3'>
				<Button variant='ghost' size='icon-xs' onClick={onCancel} aria-label='Back to story controls'>
					<ArrowLeft className='size-4' />
				</Button>
				<span className='text-sm font-semibold'>{initialFilter ? 'Edit filter' : 'New filter'}</span>
			</div>

			<div className='flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-4 py-4'>
				<FormStep index={1} title='Field' description="Columns exposed by this story's charts and tables.">
					<Select value={columnName ?? undefined} onValueChange={handleColumnChange}>
						<SelectTrigger className='h-9 w-full bg-background'>
							<SelectValue placeholder='Pick a column' />
						</SelectTrigger>
						<SelectContent>
							{filterableColumns.map((candidate) => (
								<SelectItem key={candidate.name} value={candidate.name}>
									<ColumnKindIcon kind={candidate.kind} />
									<span>{candidate.label}</span>
									<span className='text-xs text-muted-foreground'>
										{formatChartCount(candidate.blockIds.length)}
									</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FormStep>

				<FormStep
					index={2}
					title={isDateColumn ? 'Date range' : 'Values'}
					description={
						isDateColumn
							? 'Pick a preset or a custom range.'
							: 'Distinct values from the data already loaded in the story.'
					}
					disabled={!column}
				>
					{column && isDateColumn && (
						<DateRangeStep
							preset={preset}
							customRange={customRange}
							onPresetChange={setPreset}
							onCustomRangeChange={setCustomRange}
						/>
					)}
					{column && !isDateColumn && (
						<ValuesStep
							options={getDistinctColumnValues(column.name, blocks, queryData)}
							values={values}
							onChange={setValues}
						/>
					)}
				</FormStep>

				<FormStep
					index={3}
					title='Applies to'
					description='Charts without this column are skipped.'
					disabled={!column}
				>
					{column && (
						<AppliesToStep blocks={blocks} column={column} selectedIds={blockIds} onChange={setBlockIds} />
					)}
				</FormStep>
			</div>

			<div className='flex items-center justify-end gap-2 border-t px-4 py-3'>
				{draftFilter && (
					<span className='mr-auto flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground'>
						<span className='size-1.5 animate-pulse rounded-full bg-green-500' />
						Previewing on story
					</span>
				)}
				<Button variant='ghost' size='sm' onClick={onCancel}>
					Cancel
				</Button>
				<Button size='sm' disabled={!draftFilter} onClick={handleSave}>
					{initialFilter ? 'Save filter' : 'Add filter'}
				</Button>
			</div>
		</div>
	);
}

function FormStep({
	index,
	title,
	description,
	disabled = false,
	children,
}: {
	index: number;
	title: string;
	description: string;
	disabled?: boolean;
	children: React.ReactNode;
}) {
	return (
		<section className={cn('flex flex-col gap-2.5', disabled && 'opacity-50')}>
			<div className='flex items-start gap-2.5'>
				<span className='mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground'>
					{index}
				</span>
				<div className='flex flex-col'>
					<span className='text-sm font-medium'>{title}</span>
					<span className='text-xs text-muted-foreground'>{description}</span>
				</div>
			</div>
			<div className='pl-7.5'>{children}</div>
		</section>
	);
}

function DateRangeStep({
	preset,
	customRange,
	onPresetChange,
	onCustomRangeChange,
}: {
	preset: DatePresetId;
	customRange: DateRangeValue;
	onPresetChange: (preset: DatePresetId) => void;
	onCustomRangeChange: (range: DateRangeValue) => void;
}) {
	const resolvedRange = preset === 'custom' ? customRange : resolveDatePreset(preset);

	return (
		<div className='flex flex-col gap-3'>
			<StoryDatePresetChips value={preset} onChange={onPresetChange} />
			{preset === 'custom' && (
				<div className='w-fit rounded-lg border bg-background'>
					<Calendar
						mode='range'
						selected={toDayPickerRange(customRange)}
						onSelect={(range) => onCustomRangeChange(fromDayPickerRange(range))}
						numberOfMonths={1}
						navLayout='after'
					/>
				</div>
			)}
			<div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
				<CalendarIcon className='size-3.5' />
				{formatDateRangeValue(resolvedRange)}
			</div>
		</div>
	);
}

function ValuesStep({
	options,
	values,
	onChange,
}: {
	options: { value: string; count: number }[];
	values: string[];
	onChange: (values: string[]) => void;
}) {
	const [search, setSearch] = useState('');
	const visibleOptions = options.filter((option) => option.value.toLowerCase().includes(search.toLowerCase()));

	const toggleValue = (value: string, checked: boolean) =>
		onChange(checked ? [...values, value] : values.filter((candidate) => candidate !== value));

	return (
		<div className='flex flex-col gap-2'>
			<div className='relative'>
				<Search className='pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground' />
				<Input
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder='Search values'
					className='h-8 bg-background pl-8 text-sm'
				/>
			</div>
			<div className='flex items-center justify-between text-xs text-muted-foreground'>
				<span>
					{values.length} of {options.length} selected
				</span>
				<div className='flex gap-2'>
					<button
						type='button'
						className='cursor-pointer hover:text-foreground'
						onClick={() => onChange(options.map((option) => option.value))}
					>
						Select all
					</button>
					<button type='button' className='cursor-pointer hover:text-foreground' onClick={() => onChange([])}>
						Clear
					</button>
				</div>
			</div>
			<div className='flex max-h-56 flex-col overflow-auto rounded-lg border bg-background py-1'>
				{visibleOptions.map((option) => (
					<label
						key={option.value}
						className='flex cursor-pointer items-center gap-2.5 px-2.5 py-1.5 text-sm hover:bg-accent'
					>
						<Checkbox
							checked={values.includes(option.value)}
							onCheckedChange={(checked) => toggleValue(option.value, checked === true)}
						/>
						<span className='min-w-0 flex-1 truncate'>{option.value}</span>
						<span className='text-xs tabular-nums text-muted-foreground'>{option.count}</span>
					</label>
				))}
				{visibleOptions.length === 0 && (
					<span className='px-2.5 py-2 text-xs text-muted-foreground'>No matching values</span>
				)}
			</div>
		</div>
	);
}

function AppliesToStep({
	blocks,
	column,
	selectedIds,
	onChange,
}: {
	blocks: StoryControlBlock[];
	column: StoryControlColumn;
	selectedIds: string[];
	onChange: (ids: string[]) => void;
}) {
	return (
		<div className='flex flex-col gap-1'>
			{blocks.map((block) => {
				const isEligible = column.blockIds.includes(block.id);
				const BlockIcon = block.kind === 'chart' ? ChartColumn : Table2;
				return (
					<label
						key={block.id}
						className={cn(
							'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm',
							isEligible ? 'cursor-pointer hover:bg-accent' : 'cursor-not-allowed text-muted-foreground',
						)}
					>
						<Checkbox
							disabled={!isEligible}
							checked={isEligible && selectedIds.includes(block.id)}
							onCheckedChange={(checked) =>
								onChange(
									checked === true
										? [...selectedIds, block.id]
										: selectedIds.filter((candidate) => candidate !== block.id),
								)
							}
						/>
						<BlockIcon className='size-3.5 shrink-0 text-muted-foreground' />
						<span className='min-w-0 flex-1 truncate'>{block.title || block.queryId}</span>
						{!isEligible && <span className='text-[11px]'>no {column.label.toLowerCase()}</span>}
					</label>
				);
			})}
		</div>
	);
}

export function ColumnKindIcon({ kind, className }: { kind: StoryControlColumn['kind']; className?: string }) {
	const Icon = kind === 'date' ? CalendarIcon : Tag;
	return <Icon className={cn('size-3.5 text-muted-foreground', className)} />;
}

function toDayPickerRange(range: DateRangeValue): DateRange | undefined {
	if (!range.from) {
		return undefined;
	}
	return { from: parseDay(range.from), to: range.to ? parseDay(range.to) : undefined };
}

function fromDayPickerRange(range: DateRange | undefined): DateRangeValue {
	return {
		from: range?.from ? format(range.from, 'yyyy-MM-dd') : '',
		to: range?.to ? format(range.to, 'yyyy-MM-dd') : '',
	};
}

function parseDay(value: string): Date {
	const [year, month, day] = value.split('-').map(Number);
	return new Date(year, month - 1, day);
}
