import { BarChart3, CalendarRange, MapIcon, Table2 } from 'lucide-react';
import { formatColumnLabel } from '@nao/shared/story-table-utils';
import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';

import type { QueryDataMap } from '@/components/story-embeds';
import type {
	CategoryOperator,
	ManualDateRange,
	ManualFilter,
	ManualFilterTarget,
	StoryBlockKind,
	StoryBlockRef,
} from '@/lib/story-manual-filters';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
	DATE_PRESETS,
	formatDateRange,
	getDistinctValues,
	getTargetCandidates,
	resolveDateRange,
	toDateKey,
} from '@/lib/story-manual-filters';
import { cn } from '@/lib/utils';

const BLOCK_ICONS: Record<StoryBlockKind, typeof BarChart3> = { chart: BarChart3, table: Table2, map: MapIcon };

export function StoryManualFilterEditor({
	filter,
	blocks,
	queryData,
	onChange,
}: {
	filter: ManualFilter;
	blocks: StoryBlockRef[];
	queryData: QueryDataMap | null;
	onChange: (filter: ManualFilter) => void;
}) {
	return (
		<div className='flex flex-col gap-3'>
			{filter.kind === 'date' ? (
				<DateRangeSection range={filter.range} onChange={(range) => onChange({ ...filter, range })} />
			) : (
				<CategoryValuesSection
					operator={filter.operator}
					values={filter.values}
					queryData={queryData}
					targets={filter.targets}
					onOperatorChange={(operator) => onChange({ ...filter, operator })}
					onValuesChange={(values) => onChange({ ...filter, values })}
				/>
			)}
			<TargetsSection
				filter={filter}
				blocks={blocks}
				queryData={queryData}
				onChange={(targets) => onChange({ ...filter, targets })}
			/>
		</div>
	);
}

function DateRangeSection({ range, onChange }: { range: ManualDateRange; onChange: (range: ManualDateRange) => void }) {
	const [isCustomOpen, setIsCustomOpen] = useState(range.mode === 'custom');
	const resolved = resolveDateRange(range);

	return (
		<div className='flex flex-col gap-1.5'>
			<SectionLabel>Date range</SectionLabel>
			<div className='grid grid-cols-2 gap-1.5'>
				{DATE_PRESETS.map((preset) => (
					<DatePresetButton
						key={preset.id}
						label={preset.label}
						hint={formatDateRange(resolveDateRange({ mode: 'preset', preset: preset.id }))}
						isSelected={range.mode === 'preset' && range.preset === preset.id}
						onClick={() => {
							setIsCustomOpen(false);
							onChange({ mode: 'preset', preset: preset.id });
						}}
					/>
				))}
			</div>
			<button
				type='button'
				className={cn(
					'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent',
					range.mode === 'custom' && 'border-primary/50 bg-primary/5',
				)}
				onClick={() => setIsCustomOpen((current) => !current)}
			>
				<CalendarRange className='size-3.5 text-muted-foreground' />
				<span className='font-medium'>Custom range</span>
				{range.mode === 'custom' && (
					<span className='ml-auto text-[11px] text-muted-foreground'>{formatDateRange(resolved)}</span>
				)}
			</button>
			{isCustomOpen && (
				<div className='flex justify-center rounded-md border'>
					<Calendar
						mode='range'
						selected={range.mode === 'custom' ? resolved : undefined}
						defaultMonth={resolved.from}
						onSelect={(next) => onCustomRangeSelect(next, onChange)}
						numberOfMonths={1}
						navLayout='after'
					/>
				</div>
			)}
		</div>
	);
}

function DatePresetButton({
	label,
	hint,
	isSelected,
	onClick,
}: {
	label: string;
	hint: string;
	isSelected: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type='button'
			className={cn(
				'flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-1.5 text-left transition-colors hover:bg-accent',
				isSelected && 'border-primary/50 bg-primary/5 hover:bg-primary/10',
			)}
			onClick={onClick}
		>
			<span className='text-xs font-medium'>{label}</span>
			<span className='text-[10px] leading-tight text-muted-foreground'>{hint}</span>
		</button>
	);
}

function CategoryValuesSection({
	operator,
	values,
	queryData,
	targets,
	onOperatorChange,
	onValuesChange,
}: {
	operator: CategoryOperator;
	values: string[];
	queryData: QueryDataMap | null;
	targets: ManualFilterTarget[];
	onOperatorChange: (operator: CategoryOperator) => void;
	onValuesChange: (values: string[]) => void;
}) {
	const [search, setSearch] = useState('');
	const distinctValues = useMemo(() => getDistinctValues(queryData, targets), [queryData, targets]);
	const visibleValues = distinctValues.filter((item) => item.value.toLowerCase().includes(search.toLowerCase()));

	return (
		<div className='flex flex-col gap-1.5'>
			<div className='flex items-center justify-between gap-2'>
				<OperatorToggle value={operator} onChange={onOperatorChange} />
				<span className='text-[11px] text-muted-foreground'>
					{values.length > 0 ? `${values.length} of ${distinctValues.length} selected` : 'From chart data'}
				</span>
			</div>
			<Input
				type='search'
				className='h-7 text-xs'
				placeholder='Search values…'
				value={search}
				onChange={(event) => setSearch(event.target.value)}
			/>
			<div className='-mx-1 flex max-h-44 flex-col overflow-y-auto'>
				{visibleValues.map((item) => (
					<label
						key={item.value}
						className='flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-accent'
					>
						<Checkbox
							checked={values.includes(item.value)}
							onCheckedChange={(checked) =>
								onValuesChange(
									checked === true
										? [...values, item.value]
										: values.filter((value) => value !== item.value),
								)
							}
						/>
						<span className='min-w-0 flex-1 truncate'>{item.value}</span>
						<span className='tabular-nums text-muted-foreground'>{item.count}</span>
					</label>
				))}
				{visibleValues.length === 0 && (
					<span className='px-1.5 py-2 text-xs text-muted-foreground'>No matching values</span>
				)}
			</div>
		</div>
	);
}

function OperatorToggle({ value, onChange }: { value: CategoryOperator; onChange: (value: CategoryOperator) => void }) {
	const options: { id: CategoryOperator; label: string }[] = [
		{ id: 'is', label: 'is' },
		{ id: 'is_not', label: 'is not' },
	];

	return (
		<div className='inline-flex rounded-md bg-muted p-0.5'>
			{options.map((option) => (
				<button
					key={option.id}
					type='button'
					className={cn(
						'rounded-[5px] px-2 py-0.5 text-xs text-muted-foreground transition-colors',
						value === option.id && 'bg-background font-medium text-foreground shadow-xs',
					)}
					onClick={() => onChange(option.id)}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}

function TargetsSection({
	filter,
	blocks,
	queryData,
	onChange,
}: {
	filter: ManualFilter;
	blocks: StoryBlockRef[];
	queryData: QueryDataMap | null;
	onChange: (targets: ManualFilterTarget[]) => void;
}) {
	const setTargetColumn = (queryId: string, column: string | null) => {
		const others = filter.targets.filter((target) => target.queryId !== queryId);
		onChange(column ? [...others, { queryId, column }] : others);
	};

	return (
		<div className='flex flex-col gap-1.5 border-t pt-3'>
			<SectionLabel>Applies to</SectionLabel>
			<div className='flex flex-col gap-0.5'>
				{blocks.map((block) => (
					<TargetRow
						key={block.queryId}
						block={block}
						candidates={getTargetCandidates(queryData, block.queryId, filter)}
						target={filter.targets.find((target) => target.queryId === block.queryId)}
						emptyLabel={filter.kind === 'date' ? 'No date column' : `No ${filter.label} column`}
						onColumnChange={(column) => setTargetColumn(block.queryId, column)}
					/>
				))}
			</div>
		</div>
	);
}

function TargetRow({
	block,
	candidates,
	target,
	emptyLabel,
	onColumnChange,
}: {
	block: StoryBlockRef;
	candidates: string[];
	target: ManualFilterTarget | undefined;
	emptyLabel: string;
	onColumnChange: (column: string | null) => void;
}) {
	const Icon = BLOCK_ICONS[block.kind];
	const isDisabled = candidates.length === 0;

	return (
		<div className={cn('flex h-7 items-center gap-2 rounded-md px-1 text-xs', isDisabled && 'opacity-60')}>
			<Checkbox
				checked={Boolean(target)}
				disabled={isDisabled}
				onCheckedChange={(checked) => onColumnChange(checked === true ? candidates[0] : null)}
			/>
			<Icon className='size-3.5 shrink-0 text-muted-foreground' />
			<span className='min-w-0 flex-1 truncate'>{block.title || 'Untitled'}</span>
			{isDisabled ? (
				<span className='shrink-0 text-[11px] text-muted-foreground'>{emptyLabel}</span>
			) : candidates.length > 1 && target ? (
				<Select value={target.column} onValueChange={onColumnChange}>
					<SelectTrigger size='sm' className='h-6 max-w-28 gap-1 px-1.5 text-[11px]'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{candidates.map((column) => (
							<SelectItem key={column} value={column} className='text-xs'>
								{formatColumnLabel(column)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			) : (
				<span className='shrink-0 text-[11px] text-muted-foreground'>
					{formatColumnLabel(target?.column ?? candidates[0])}
				</span>
			)}
		</div>
	);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
	return <span className='text-[11px] font-medium text-muted-foreground'>{children}</span>;
}

function onCustomRangeSelect(range: DateRange | undefined, onChange: (range: ManualDateRange) => void) {
	if (!range?.from) {
		return;
	}
	onChange({ mode: 'custom', from: toDateKey(range.from), to: toDateKey(range.to ?? range.from) });
}
