import {
	ChartColumn,
	ChevronDown,
	MessageSquare,
	PanelRightClose,
	Pencil,
	Plus,
	SlidersHorizontal,
	Table2,
	X,
} from 'lucide-react';
import { useState } from 'react';

import type { QueryDataMap } from '@/components/story-embeds';
import type { StoryControls } from '@/hooks/use-story-controls';
import type { ManualFilter, StoryControlBlock, StoryControlColumn } from '@/lib/story-controls';
import { StoryBlockDisplaySettings } from '@/components/story-block-display-settings';
import { StoryDatePresetChips } from '@/components/story-date-preset-chips';
import { ColumnKindIcon, StoryFilterForm } from '@/components/story-filter-form';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import {
	describeManualFilter,
	formatChartCount,
	getFilterableColumns,
	hasDisplaySettings,
	humanizeColumnName,
	isManualFilterActive,
} from '@/lib/story-controls';
import { cn } from '@/lib/utils';

type SidebarView = { kind: 'overview' } | { kind: 'filter-form'; filter?: ManualFilter };

interface StoryControlsSidebarProps {
	controls: StoryControls;
	queryData: QueryDataMap | null;
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}

export function StoryControlsSidebar({ controls, queryData, isOpen, onOpenChange }: StoryControlsSidebarProps) {
	const [view, setView] = useState<SidebarView>({ kind: 'overview' });

	if (!isOpen) {
		return <CollapsedRail activeFilterCount={controls.activeFilterCount} onOpen={() => onOpenChange(true)} />;
	}

	return (
		<aside
			aria-label='Story controls'
			className='flex w-80 shrink-0 flex-col border-l bg-sidebar/40 animate-in slide-in-from-right-4 duration-200'
		>
			{view.kind === 'filter-form' ? (
				<StoryFilterForm
					key={view.filter?.id ?? 'new'}
					blocks={controls.blocks}
					columns={controls.columns}
					queryData={queryData}
					initialFilter={view.filter}
					onCancel={() => setView({ kind: 'overview' })}
					onPreviewChange={controls.previewFilter}
					onSave={(filter) => {
						controls.saveFilter(filter);
						setView({ kind: 'overview' });
					}}
				/>
			) : (
				<>
					<SidebarHeader onClose={() => onOpenChange(false)} />
					<div className='flex min-h-0 flex-1 flex-col overflow-auto'>
						<FiltersSection
							controls={controls}
							onAddFilter={() => setView({ kind: 'filter-form' })}
							onEditFilter={(filter) => setView({ kind: 'filter-form', filter })}
						/>
						<DisplaySection controls={controls} queryData={queryData} />
					</div>
					<div className='flex items-start gap-2 border-t px-4 py-3 text-xs text-muted-foreground'>
						<MessageSquare className='mt-px size-3.5 shrink-0' />
						<span>Need a filter the sidebar can't build? Ask the agent in chat.</span>
					</div>
				</>
			)}
		</aside>
	);
}

function CollapsedRail({ activeFilterCount, onOpen }: { activeFilterCount: number; onOpen: () => void }) {
	return (
		<div className='flex w-11 shrink-0 flex-col items-center border-l py-3'>
			<SimpleTooltip content='Story controls'>
				<Button
					variant='ghost'
					size='icon-sm'
					className='relative'
					onClick={onOpen}
					aria-label='Open story controls'
				>
					<SlidersHorizontal className='size-4' />
					{activeFilterCount > 0 && (
						<span className='absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background'>
							{activeFilterCount}
						</span>
					)}
				</Button>
			</SimpleTooltip>
		</div>
	);
}

function SidebarHeader({ onClose }: { onClose: () => void }) {
	return (
		<div className='flex items-center gap-2 border-b px-4 py-3'>
			<SlidersHorizontal className='size-4 text-muted-foreground' />
			<span className='flex-1 text-sm font-semibold'>Story controls</span>
			<SimpleTooltip content='Collapse'>
				<Button variant='ghost' size='icon-xs' onClick={onClose} aria-label='Collapse story controls'>
					<PanelRightClose className='size-4' />
				</Button>
			</SimpleTooltip>
		</div>
	);
}

function FiltersSection({
	controls,
	onAddFilter,
	onEditFilter,
}: {
	controls: StoryControls;
	onAddFilter: () => void;
	onEditFilter: (filter: ManualFilter) => void;
}) {
	const canAddFilter = getFilterableColumns(controls.columns).length > 0;

	return (
		<section className='flex flex-col gap-3 border-b px-4 py-4'>
			<SectionHeading
				title='Filters'
				count={controls.activeFilterCount}
				action={
					controls.filters.length > 0 && (
						<button
							type='button'
							className='cursor-pointer text-xs text-muted-foreground hover:text-foreground'
							onClick={controls.clearFilters}
						>
							Clear all
						</button>
					)
				}
			/>
			{controls.filters.length === 0 && (
				<p className='text-xs text-muted-foreground'>
					Filter by any column shown in this story's charts. Changes apply instantly.
				</p>
			)}
			{controls.filters.map((filter) => (
				<FilterCard
					key={filter.id}
					filter={filter}
					column={controls.columns.find((column) => column.name === filter.column)}
					onChange={controls.saveFilter}
					onEdit={() => onEditFilter(filter)}
					onRemove={() => controls.removeFilter(filter.id)}
				/>
			))}
			<Button
				variant='outline'
				size='sm'
				className='w-full gap-1.5'
				onClick={onAddFilter}
				disabled={!canAddFilter}
			>
				<Plus className='size-3.5' />
				Add filter
			</Button>
		</section>
	);
}

function FilterCard({
	filter,
	column,
	onChange,
	onEdit,
	onRemove,
}: {
	filter: ManualFilter;
	column: StoryControlColumn | undefined;
	onChange: (filter: ManualFilter) => void;
	onEdit: () => void;
	onRemove: () => void;
}) {
	const isActive = isManualFilterActive(filter);

	return (
		<div className={cn('flex flex-col gap-2.5 rounded-lg border bg-background p-3', !isActive && 'border-dashed')}>
			<div className='flex items-center gap-2'>
				<ColumnKindIcon kind={filter.kind === 'date' ? 'date' : 'category'} />
				<span className='min-w-0 flex-1 truncate text-sm font-medium'>
					{column?.label ?? humanizeColumnName(filter.column)}
				</span>
				<Button variant='ghost' size='icon-xs' onClick={onEdit} aria-label='Edit filter'>
					<Pencil className='size-3' />
				</Button>
				<Button variant='ghost' size='icon-xs' onClick={onRemove} aria-label='Remove filter'>
					<X className='size-3.5' />
				</Button>
			</div>

			{filter.kind === 'date' ? (
				<>
					<StoryDatePresetChips
						size='small'
						includeCustom={false}
						value={filter.preset === 'custom' ? null : filter.preset}
						onChange={(preset) => onChange({ ...filter, preset })}
					/>
					<span className='text-xs text-muted-foreground'>{describeManualFilter(filter)}</span>
				</>
			) : (
				<ValueChips
					values={filter.values}
					onRemove={(value) =>
						onChange({ ...filter, values: filter.values.filter((candidate) => candidate !== value) })
					}
					onEdit={onEdit}
				/>
			)}

			<span className='text-[11px] text-muted-foreground'>
				Applies to {formatChartCount(filter.blockIds.length)}
			</span>
		</div>
	);
}

function ValueChips({
	values,
	onRemove,
	onEdit,
}: {
	values: string[];
	onRemove: (value: string) => void;
	onEdit: () => void;
}) {
	if (values.length === 0) {
		return (
			<button
				type='button'
				className='w-fit cursor-pointer text-xs text-muted-foreground hover:text-foreground'
				onClick={onEdit}
			>
				Any value · pick values
			</button>
		);
	}

	return (
		<div className='flex flex-wrap gap-1.5'>
			{values.map((value) => (
				<span
					key={value}
					className='inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2 text-[11px] font-medium'
				>
					{value}
					<button
						type='button'
						className='cursor-pointer rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground'
						onClick={() => onRemove(value)}
						aria-label={`Remove ${value}`}
					>
						<X className='size-2.5' />
					</button>
				</span>
			))}
		</div>
	);
}

function DisplaySection({ controls, queryData }: { controls: StoryControls; queryData: QueryDataMap | null }) {
	return (
		<section className='flex flex-col gap-1 px-4 py-4'>
			<SectionHeading title='Charts & tables' count={controls.blocks.length} />
			<Accordion type='multiple'>
				{controls.blocks.map((block) => (
					<BlockSettingsItem key={block.id} block={block} controls={controls} queryData={queryData} />
				))}
			</Accordion>
		</section>
	);
}

function BlockSettingsItem({
	block,
	controls,
	queryData,
}: {
	block: StoryControlBlock;
	controls: StoryControls;
	queryData: QueryDataMap | null;
}) {
	const settings = controls.displaySettings[block.id];
	const isCustomized = hasDisplaySettings(settings);
	const filterCount = controls.filters.filter(
		(filter) => isManualFilterActive(filter) && filter.blockIds.includes(block.id),
	).length;
	const BlockIcon = block.kind === 'chart' ? ChartColumn : Table2;

	return (
		<AccordionItem value={block.id}>
			<AccordionTrigger className='group items-center gap-2 py-2.5 hover:no-underline'>
				<BlockIcon className='size-3.5 shrink-0 text-muted-foreground' />
				<span className='min-w-0 flex-1 truncate'>{block.title || block.queryId}</span>
				{filterCount > 0 && (
					<SimpleTooltip content={`${filterCount} filter${filterCount > 1 ? 's' : ''} applied`}>
						<span className='rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground'>
							{filterCount}
						</span>
					</SimpleTooltip>
				)}
				{isCustomized && <span className='size-1.5 shrink-0 rounded-full bg-primary' aria-label='Customized' />}
				<ChevronDown className='size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180' />
			</AccordionTrigger>
			<AccordionContent className='flex flex-col gap-3 pb-3'>
				<StoryBlockDisplaySettings
					block={block}
					columns={controls.columns}
					queryData={queryData}
					settings={settings}
					onChange={(next) => controls.updateDisplaySettings(block.id, next)}
				/>
				{isCustomized && (
					<button
						type='button'
						className='w-fit cursor-pointer text-xs text-muted-foreground hover:text-foreground'
						onClick={() => controls.resetDisplaySettings(block.id)}
					>
						Reset to story defaults
					</button>
				)}
			</AccordionContent>
		</AccordionItem>
	);
}

function SectionHeading({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
	return (
		<div className='flex items-center gap-2'>
			<span className='text-xs font-semibold tracking-wide text-muted-foreground uppercase'>{title}</span>
			{count !== undefined && count > 0 && (
				<span className='rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground'>
					{count}
				</span>
			)}
			<span className='flex-1' />
			{action}
		</div>
	);
}
