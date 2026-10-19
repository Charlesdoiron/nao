import { useEffect, useMemo, useRef } from 'react';
import { Braces, Trash2 } from 'lucide-react';
import { isFilterSelectionActive, renderFilterSqlValue } from '@nao/shared/sql-template';
import type { StoryFilterSelection } from '@nao/shared/sql-template';
import type { ParsedFilterBlock } from '@nao/shared/story-segments';

import type { StoryFilterApi } from '@/hooks/use-story-filters';
import { useFilterOptions } from '@/components/story-filter-bar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const FILTER_TYPE_LABELS: Record<ParsedFilterBlock['filterType'], string> = {
	select: 'Single select',
	multi_select: 'Multi select',
	search: 'Text search',
	date_range: 'Date range',
};
export interface SqlFilterPopoverTarget {
	filterId: string;
	rect: DOMRect;
}

interface SqlFilterPopoverProps {
	target: SqlFilterPopoverTarget | null;
	filter: ParsedFilterBlock | undefined;
	clause: string | null;
	selection: StoryFilterSelection | undefined;
	api?: StoryFilterApi | null;
	onSelectionChange: (filterId: string, selection: StoryFilterSelection) => void;
	onClose: () => void;
	onEditJinja?: (filterId: string) => void;
	onRemove?: (filterId: string) => void;
}

/** Edits the test value of a story filter referenced in the SQL, anchored to its inline chip. */
export function SqlFilterPopover({
	target,
	filter,
	clause,
	selection,
	api,
	onSelectionChange,
	onClose,
	onEditJinja,
	onRemove,
}: SqlFilterPopoverProps) {
	const rect = target?.rect;
	const anchorRef = useMemo(() => ({ current: { getBoundingClientRect: () => rect ?? new DOMRect() } }), [rect]);
	const isOpen = Boolean(target && filter);
	useEscapeToCloseWithinDialog(isOpen, onClose);

	if (!target || !filter) {
		return null;
	}

	return (
		<Popover open modal onOpenChange={(open) => !open && onClose()}>
			<PopoverAnchor virtualRef={anchorRef} />
			<PopoverContent align='start' className='w-80 p-0' onOpenAutoFocus={(event) => event.preventDefault()}>
				<div className='flex items-start justify-between gap-2 border-b px-4 py-3'>
					<div className='min-w-0'>
						<div className='truncate text-sm font-semibold text-foreground'>{filter.label}</div>
						<div className='truncate text-xs text-muted-foreground'>
							{FILTER_TYPE_LABELS[filter.filterType]}
							{filter.column && (
								<>
									{' · '}
									<span className='font-mono'>
										{filter.table ? `${filter.table}.${filter.column}` : filter.column}
									</span>
								</>
							)}
						</div>
					</div>
					<code className='shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground'>
						{filter.id}
					</code>
				</div>
				<div className='flex flex-col gap-3 px-4 py-3'>
					<div className='flex flex-col gap-1.5'>
						<div className='flex items-center justify-between'>
							<span className='text-xs font-medium text-muted-foreground'>Test value</span>
							{isFilterSelectionActive(filter.filterType, selection) && (
								<button
									type='button'
									className='text-[11px] text-muted-foreground hover:text-foreground'
									onClick={() => onSelectionChange(filter.id, emptySelection(filter.filterType))}
								>
									Clear
								</button>
							)}
						</div>
						<FilterValueEditor
							filter={filter}
							selection={selection}
							api={api}
							onChange={(next) => onSelectionChange(filter.id, next)}
						/>
					</div>
					{clause !== null && <ClausePreview filter={filter} clause={clause} selection={selection} />}
				</div>
				{(onEditJinja || onRemove) && (
					<div className='flex items-center justify-between gap-2 border-t px-2 py-1.5'>
						{onEditJinja && (
							<Button
								type='button'
								variant='ghost'
								size='sm'
								className='h-7 gap-1.5 text-xs'
								onClick={() => onEditJinja(filter.id)}
							>
								<Braces className='size-3.5' />
								Edit as Jinja
							</Button>
						)}
						{onRemove && (
							<Button
								type='button'
								variant='ghost'
								size='sm'
								className='h-7 gap-1.5 text-xs text-destructive hover:text-destructive'
								onClick={() => onRemove(filter.id)}
							>
								<Trash2 className='size-3.5' />
								Remove from query
							</Button>
						)}
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}

function ClausePreview({
	filter,
	clause,
	selection,
}: {
	filter: ParsedFilterBlock;
	clause: string;
	selection: StoryFilterSelection | undefined;
}) {
	const isActive = isFilterSelectionActive(filter.filterType, selection);
	const rendered = useMemo(
		() => (isActive ? renderClause(clause, filter, selection) : null),
		[isActive, clause, filter, selection],
	);

	return (
		<div className='flex flex-col gap-1'>
			<span className='text-xs font-medium text-muted-foreground'>Injected SQL</span>
			{rendered ? (
				<code className='block whitespace-pre-wrap break-all rounded-md border bg-muted/40 px-2 py-1.5 font-mono text-[11px] text-foreground'>
					{rendered}
				</code>
			) : (
				<p className='rounded-md border border-dashed px-2 py-1.5 text-[11px] text-muted-foreground'>
					No test value: this condition is dropped and the query runs unfiltered.
				</p>
			)}
		</div>
	);
}

function renderClause(clause: string, filter: ParsedFilterBlock, selection: StoryFilterSelection | undefined) {
	const value = renderFilterSqlValue(filter.filterType, selection) ?? '';
	const placeholder = new RegExp(String.raw`\{\{\s*filters\.${filter.id}\.sql\s*\}\}`, 'g');
	return clause.replace(placeholder, value).replace(/\s+/g, ' ').trim();
}

/**
 * Value pickers are rendered inline rather than in nested menus: the frontend resolves its own copy
 * of the Radix popover, whose layer stack does not coordinate with the dialog's dropdowns and selects.
 */
function FilterValueEditor({
	filter,
	selection,
	api,
	onChange,
}: {
	filter: ParsedFilterBlock;
	selection: StoryFilterSelection | undefined;
	api?: StoryFilterApi | null;
	onChange: (selection: StoryFilterSelection) => void;
}) {
	const { options, error, isLoading } = useFilterOptions(filter, api);

	if (filter.filterType === 'search') {
		return (
			<Input
				className='h-8 text-sm'
				placeholder='Text to search for'
				value={typeof selection === 'string' ? selection : ''}
				onChange={(event) => onChange(event.target.value)}
			/>
		);
	}

	if (filter.filterType === 'date_range') {
		const [from = '', to = ''] = Array.isArray(selection) ? selection : [];
		return (
			<div className='flex items-center gap-1.5'>
				<Input
					type='date'
					className='h-8 text-sm'
					value={from}
					onChange={(event) => onChange([event.target.value, to])}
				/>
				<span className='text-xs text-muted-foreground'>→</span>
				<Input
					type='date'
					className='h-8 text-sm'
					value={to}
					onChange={(event) => onChange([from, event.target.value])}
				/>
			</div>
		);
	}

	if (isLoading || error) {
		return <p className='text-xs text-muted-foreground'>{error ?? 'Loading values…'}</p>;
	}

	const selectedValues = toSelectedValues(selection);
	const toggleValue = (value: string) => {
		if (filter.filterType === 'select') {
			onChange(selectedValues.includes(value) ? '' : value);
			return;
		}
		onChange(
			selectedValues.includes(value)
				? selectedValues.filter((candidate) => candidate !== value)
				: [...selectedValues, value],
		);
	};

	return (
		<ul className='flex max-h-44 flex-col overflow-y-auto rounded-md border p-1'>
			{options.map((option) => (
				<li key={option}>
					<label
						className={cn(
							'flex h-7 cursor-pointer items-center gap-2 rounded px-2 text-sm hover:bg-accent',
							selectedValues.includes(option) && 'font-medium',
						)}
					>
						<Checkbox
							checked={selectedValues.includes(option)}
							onCheckedChange={() => toggleValue(option)}
							className={cn(filter.filterType === 'select' && 'rounded-full')}
						/>
						<span className='truncate'>{option}</span>
					</label>
				</li>
			))}
		</ul>
	);
}

/**
 * The popover's layer stack is unaware of the surrounding dialog, so Escape would close both;
 * intercept it before Radix sees it.
 */
function useEscapeToCloseWithinDialog(isOpen: boolean, onClose: () => void) {
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	useEffect(() => {
		if (!isOpen) {
			return;
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') {
				return;
			}
			event.stopPropagation();
			onCloseRef.current();
		};
		window.addEventListener('keydown', handleKeyDown, true);
		return () => window.removeEventListener('keydown', handleKeyDown, true);
	}, [isOpen]);
}

function toSelectedValues(selection: StoryFilterSelection | undefined): string[] {
	if (Array.isArray(selection)) {
		return selection;
	}
	return selection ? [selection] : [];
}

function emptySelection(filterType: ParsedFilterBlock['filterType']): StoryFilterSelection {
	return filterType === 'select' || filterType === 'search' ? '' : [];
}
