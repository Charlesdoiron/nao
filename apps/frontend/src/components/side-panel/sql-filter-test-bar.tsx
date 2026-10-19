import { Filter, FilterX, Plus } from 'lucide-react';
import { isFilterSelectionActive } from '@nao/shared/sql-template';
import type { StoryFilterSelection, StoryFilterSelections } from '@nao/shared/sql-template';
import type { ParsedFilterBlock } from '@nao/shared/story-segments';

import type { SqlFilterPopoverTarget } from '@/components/side-panel/sql-filter-popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MAX_LISTED_VALUES = 2;

interface SqlFilterTestBarProps {
	filters: ParsedFilterBlock[];
	referencedFilterIds: string[];
	selections: StoryFilterSelections;
	onOpenFilter: (target: SqlFilterPopoverTarget) => void;
	onInsertFilter: (filter: ParsedFilterBlock) => void;
	onClear: () => void;
}

/** Test values for the story filters used by the query, plus shortcuts to wire the unused ones. */
export function SqlFilterTestBar({
	filters,
	referencedFilterIds,
	selections,
	onOpenFilter,
	onInsertFilter,
	onClear,
}: SqlFilterTestBarProps) {
	const referenced = filters.filter((filter) => referencedFilterIds.includes(filter.id));
	const unreferenced = filters.filter((filter) => !referencedFilterIds.includes(filter.id));
	const hasActiveValues = referenced.some((filter) =>
		isFilterSelectionActive(filter.filterType, selections[filter.id]),
	);

	if (filters.length === 0) {
		return null;
	}

	return (
		<div className='flex shrink-0 flex-wrap items-center gap-1.5 border-b bg-muted/20 px-4 py-2'>
			<span className='mr-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground'>
				<Filter className='size-3.5' />
				Test filters
			</span>
			{referenced.map((filter) => (
				<TestValuePill
					key={filter.id}
					filter={filter}
					selection={selections[filter.id]}
					onClick={(rect) => onOpenFilter({ filterId: filter.id, rect })}
				/>
			))}
			{referenced.length === 0 && (
				<span className='text-xs text-muted-foreground'>This query doesn't use any story filter yet.</span>
			)}
			{unreferenced.map((filter) => (
				<button
					key={filter.id}
					type='button'
					className='flex h-6 items-center gap-1 rounded-full border border-dashed px-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary'
					title={`Add a ${filter.label} condition to the query`}
					onClick={() => onInsertFilter(filter)}
				>
					<Plus className='size-3' />
					{filter.label}
				</button>
			))}
			{hasActiveValues && (
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className='ml-auto h-6 gap-1 px-2 text-xs'
					onClick={onClear}
				>
					<FilterX className='size-3' />
					Clear test values
				</Button>
			)}
		</div>
	);
}

function TestValuePill({
	filter,
	selection,
	onClick,
}: {
	filter: ParsedFilterBlock;
	selection: StoryFilterSelection | undefined;
	onClick: (rect: DOMRect) => void;
}) {
	const isActive = isFilterSelectionActive(filter.filterType, selection);

	return (
		<button
			type='button'
			className={cn(
				'flex h-6 max-w-64 items-center gap-1 rounded-full border px-2 text-xs transition-colors',
				isActive
					? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15'
					: 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
			)}
			onClick={(event) => onClick(event.currentTarget.getBoundingClientRect())}
		>
			<span className='font-medium'>{filter.label}</span>
			<span className='truncate opacity-80'>{isActive ? summarizeSelection(filter, selection) : 'any'}</span>
		</button>
	);
}

function summarizeSelection(filter: ParsedFilterBlock, selection: StoryFilterSelection | undefined): string {
	if (typeof selection === 'string') {
		return filter.filterType === 'search' ? `contains “${selection}”` : selection;
	}
	const values = (selection ?? []).filter((value) => value.trim() !== '');
	if (filter.filterType === 'date_range') {
		return `${values[0]} → ${values[1]}`;
	}
	if (values.length > MAX_LISTED_VALUES) {
		return `${values.slice(0, MAX_LISTED_VALUES).join(', ')} +${values.length - MAX_LISTED_VALUES}`;
	}
	return values.join(', ');
}
