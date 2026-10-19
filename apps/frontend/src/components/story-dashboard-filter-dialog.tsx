import { ChartColumn, Filter, MessageSquare, Search, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { DashboardColumn, DashboardFilter } from '@/lib/story-dashboard-filters';
import type { StoryDashboardEdit } from '@/hooks/use-story-dashboard-edit';
import { COLUMN_KIND_ICONS } from '@/components/story-dashboard-block';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input, NakedInput } from '@/components/ui/input';
import { getDistinctValues, humanizeColumnName } from '@/lib/story-dashboard-filters';
import { cn } from '@/lib/utils';

export function StoryDashboardFilterDialog({
	dashboard,
	onAskAgent,
}: {
	dashboard: StoryDashboardEdit;
	onAskAgent?: () => void;
}) {
	const { filterDialog } = dashboard;
	const editingFilter = dashboard.filters.find((filter) => filter.id === filterDialog.editingFilterId) ?? null;

	return (
		<Dialog open={filterDialog.isOpen} onOpenChange={(open) => !open && dashboard.closeFilterDialog()}>
			<DialogContent className='gap-0 p-0 sm:max-w-3xl'>
				{filterDialog.isOpen && (
					<FilterDialogBody
						key={filterDialog.editingFilterId ?? 'new'}
						dashboard={dashboard}
						editingFilter={editingFilter}
						presetBlockKeys={filterDialog.presetBlockKeys}
						onAskAgent={onAskAgent}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

function FilterDialogBody({
	dashboard,
	editingFilter,
	presetBlockKeys,
	onAskAgent,
}: {
	dashboard: StoryDashboardEdit;
	editingFilter: DashboardFilter | null;
	presetBlockKeys: string[];
	onAskAgent?: () => void;
}) {
	const [search, setSearch] = useState('');
	const [columnName, setColumnName] = useState<string | null>(
		editingFilter?.column ?? pickDefaultColumn(dashboard.columns, presetBlockKeys),
	);
	const column = dashboard.columns.find((candidate) => candidate.name === columnName) ?? null;
	const [targetBlockKeys, setTargetBlockKeys] = useState<string[]>(
		editingFilter?.targetBlockKeys ?? defaultTargets(column, presetBlockKeys),
	);
	const [label, setLabel] = useState(editingFilter?.label ?? (column ? humanizeColumnName(column.name) : ''));

	const selectColumn = (next: DashboardColumn) => {
		setColumnName(next.name);
		setTargetBlockKeys(defaultTargets(next, presetBlockKeys));
		setLabel(humanizeColumnName(next.name));
	};

	const filterableColumns = dashboard.columns.filter((candidate) => candidate.kind !== 'number');
	const metricColumns = dashboard.columns.filter((candidate) => candidate.kind === 'number');
	const matchesSearch = (candidate: DashboardColumn) =>
		candidate.name.toLowerCase().includes(search.trim().toLowerCase());

	const distinctValueCount = useMemo(() => {
		if (!column || column.kind !== 'text') {
			return 0;
		}
		const rowSets = dashboard.blocks
			.filter((block) => column.blockKeys.includes(block.key))
			.map((block) => dashboard.queryData?.[block.queryId]?.data ?? []);
		return getDistinctValues(rowSets, column.name).length;
	}, [column, dashboard.blocks, dashboard.queryData]);

	const canSave = Boolean(column && targetBlockKeys.length > 0 && label.trim());

	const handleSave = () => {
		if (!column) {
			return;
		}
		dashboard.saveFilter({
			id: editingFilter?.id ?? crypto.randomUUID(),
			label: label.trim(),
			column: column.name,
			type: column.kind === 'date' ? 'date_range' : 'values',
			targetBlockKeys,
			values: editingFilter?.column === column.name ? editingFilter.values : [],
			dateRange: editingFilter?.column === column.name ? editingFilter.dateRange : null,
		});
		dashboard.closeFilterDialog();
	};

	return (
		<>
			<DialogHeader className='border-b px-5 py-4'>
				<DialogTitle className='flex items-center gap-2 text-base'>
					<Filter className='size-4' />
					{editingFilter ? 'Edit filter' : 'Add a filter'}
				</DialogTitle>
				<DialogDescription>
					Choose a column exposed by your charts, then pick the charts it should filter. Values come from the
					data already loaded in the story — no extra query.
				</DialogDescription>
			</DialogHeader>

			<div className='grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]'>
				<section className='flex min-h-0 flex-col border-r'>
					<StepTitle step={1}>Column</StepTitle>
					<div className='mx-4 mb-2 flex items-center gap-2 rounded-md border px-2.5'>
						<Search className='size-3.5 text-muted-foreground' />
						<NakedInput
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder='Search columns'
							className='h-8 w-full text-sm'
						/>
					</div>
					<div className='max-h-80 overflow-auto px-2 pb-3'>
						{filterableColumns.filter(matchesSearch).map((candidate) => (
							<ColumnOption
								key={candidate.name}
								column={candidate}
								isSelected={candidate.name === columnName}
								onSelect={() => selectColumn(candidate)}
							/>
						))}
						{metricColumns.some(matchesSearch) && (
							<>
								<div className='px-2 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
									Metrics · ask nao to filter on these
								</div>
								{metricColumns.filter(matchesSearch).map((candidate) => (
									<ColumnOption key={candidate.name} column={candidate} isSelected={false} disabled />
								))}
							</>
						)}
					</div>
				</section>

				<section className='flex min-h-0 flex-col'>
					<StepTitle step={2}>Apply to</StepTitle>
					<div className='max-h-60 overflow-auto px-2'>
						{dashboard.blocks.map((block) => {
							const exposesColumn = Boolean(column?.blockKeys.includes(block.key));
							const isChecked = exposesColumn && targetBlockKeys.includes(block.key);
							const KindIcon = block.kind === 'chart' ? ChartColumn : Table2;
							return (
								<label
									key={block.key}
									className={cn(
										'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm',
										exposesColumn
											? 'cursor-pointer hover:bg-accent'
											: 'cursor-not-allowed opacity-50',
									)}
								>
									<Checkbox
										checked={isChecked}
										disabled={!exposesColumn}
										onCheckedChange={(checked) =>
											setTargetBlockKeys((current) =>
												checked === true
													? [...current, block.key]
													: current.filter((key) => key !== block.key),
											)
										}
									/>
									<KindIcon className='size-3.5 text-muted-foreground' />
									<span className='min-w-0 flex-1 truncate'>{block.title}</span>
									{!exposesColumn && column && (
										<span className='shrink-0 text-[11px] text-muted-foreground'>
											no <code className='font-mono'>{column.name}</code>
										</span>
									)}
								</label>
							);
						})}
					</div>

					<div className='mt-2 flex flex-col gap-3 border-t px-4 py-3'>
						<label className='flex flex-col gap-1'>
							<span className='text-xs font-medium text-muted-foreground'>Label shown to viewers</span>
							<Input value={label} onChange={(event) => setLabel(event.target.value)} className='h-8' />
						</label>
						{column && (
							<div className='rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground'>
								{column.kind === 'date' ? (
									<>
										<span className='font-medium text-foreground'>Date range</span> with quick
										ranges: this month, last month, last 3 months, this year, previous year.
									</>
								) : (
									<>
										<span className='font-medium text-foreground'>Multi-select</span> with{' '}
										{distinctValueCount} values found in the chart data.
									</>
								)}
							</div>
						)}
					</div>
				</section>
			</div>

			<DialogFooter className='items-center border-t px-5 py-3 sm:justify-between'>
				{onAskAgent ? (
					<Button variant='ghost-muted' size='sm' className='gap-1.5' onClick={onAskAgent}>
						<MessageSquare className='size-3.5' />
						Need it in the SQL? Ask nao
					</Button>
				) : (
					<span />
				)}
				<div className='flex items-center gap-2'>
					<Button variant='outline' size='sm' onClick={dashboard.closeFilterDialog}>
						Cancel
					</Button>
					<Button variant='primary-gradient' size='sm' disabled={!canSave} onClick={handleSave}>
						{editingFilter ? 'Save filter' : 'Add filter'}
					</Button>
				</div>
			</DialogFooter>
		</>
	);
}

function StepTitle({ step, children }: { step: number; children: React.ReactNode }) {
	return (
		<div className='flex items-center gap-2 px-4 pt-4 pb-2 text-sm font-medium'>
			<span className='flex size-5 items-center justify-center rounded-full bg-muted text-[11px] font-semibold'>
				{step}
			</span>
			{children}
		</div>
	);
}

function ColumnOption({
	column,
	isSelected,
	disabled = false,
	onSelect,
}: {
	column: DashboardColumn;
	isSelected: boolean;
	disabled?: boolean;
	onSelect?: () => void;
}) {
	const Icon = COLUMN_KIND_ICONS[column.kind];
	return (
		<button
			type='button'
			disabled={disabled}
			onClick={onSelect}
			className={cn(
				'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors',
				disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-accent',
				isSelected && 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
			)}
		>
			<Icon className='size-3.5 shrink-0' />
			<span className='min-w-0 flex-1 truncate font-mono text-[12.5px]'>{column.name}</span>
			<span className='shrink-0 text-[11px] text-muted-foreground'>
				{column.blockKeys.length} {column.blockKeys.length === 1 ? 'block' : 'blocks'}
			</span>
		</button>
	);
}

function pickDefaultColumn(columns: DashboardColumn[], presetBlockKeys: string[]): string | null {
	const candidates = columns.filter((column) => column.kind !== 'number');
	const sharedByPreset = candidates.find((column) => presetBlockKeys.every((key) => column.blockKeys.includes(key)));
	return (presetBlockKeys.length > 0 ? sharedByPreset?.name : null) ?? candidates[0]?.name ?? null;
}

function defaultTargets(column: DashboardColumn | null, presetBlockKeys: string[]): string[] {
	if (!column) {
		return [];
	}
	const preset = presetBlockKeys.filter((key) => column.blockKeys.includes(key));
	return preset.length > 0 ? preset : column.blockKeys;
}
