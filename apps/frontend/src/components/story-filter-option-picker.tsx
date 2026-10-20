import { useVirtualizer } from '@tanstack/react-virtual';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const OPTION_ROW_HEIGHT = 32;
const LIST_MAX_HEIGHT = 256;
const LIST_VERTICAL_PADDING = 4;
const SEARCH_MIN_OPTIONS = 10;

interface OptionPickerProps {
	label: string;
	options: string[];
	value: string[];
	multiple: boolean;
	onChange: (value: string[]) => void;
}

export function StoryFilterOptionPicker({ label, options, value, multiple, onChange }: OptionPickerProps) {
	const [isOpen, setIsOpen] = useState(false);

	const handleChange = (next: string[]) => {
		onChange(next);
		if (!multiple) {
			setIsOpen(false);
		}
	};

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button
					variant='outline'
					size='sm'
					className='h-8 min-w-36 max-w-64 justify-between gap-2 bg-background font-normal'
					aria-label={`${label} filter`}
				>
					<TriggerLabel value={value} />
					<ChevronsUpDown className='size-3.5 shrink-0 text-muted-foreground' />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align='start'
				className='flex w-72 flex-col overflow-hidden p-0'
				onEscapeKeyDown={keepOpenWhileSearchHasText}
			>
				<OptionPickerPanel
					label={label}
					options={options}
					value={value}
					multiple={multiple}
					onChange={handleChange}
				/>
			</PopoverContent>
		</Popover>
	);
}

function TriggerLabel({ value }: { value: string[] }) {
	if (value.length === 0) {
		return <span>All</span>;
	}

	return (
		<span className='flex min-w-0 items-center gap-1.5'>
			<span className='truncate'>{value[0]}</span>
			{value.length > 1 && (
				<span className='shrink-0 rounded-sm bg-muted px-1 text-[10px] font-medium text-muted-foreground'>
					+{value.length - 1}
				</span>
			)}
		</span>
	);
}

function OptionPickerPanel({ label, options, value, multiple, onChange }: OptionPickerProps) {
	const listboxId = useId();
	const [query, setQuery] = useState('');
	const matches = useMemo(() => filterOptions(options, query), [options, query]);
	const selected = useMemo(() => new Set(value), [value]);
	const initialIndex = multiple ? 0 : Math.max(options.indexOf(value[0] ?? ''), 0);
	const [activeIndex, setActiveIndex] = useState(initialIndex);
	const listRef = useRef<HTMLDivElement>(null);

	const virtualizer = useVirtualizer({
		count: matches.length,
		getScrollElement: () => listRef.current,
		estimateSize: () => OPTION_ROW_HEIGHT,
		paddingStart: LIST_VERTICAL_PADDING,
		paddingEnd: LIST_VERTICAL_PADDING,
		initialOffset: centeredOffset(initialIndex),
		overscan: 8,
	});

	const isSearchable = options.length >= SEARCH_MIN_OPTIONS;
	const activeOption = matches[activeIndex];

	const toggleOption = (option: string) => {
		if (!multiple) {
			onChange([option]);
			return;
		}
		onChange(selected.has(option) ? value.filter((item) => item !== option) : [...value, option]);
	};

	const selectAllMatches = () => {
		onChange([...value, ...matches.filter((option) => !selected.has(option))]);
	};

	const updateQuery = (nextQuery: string) => {
		setQuery(nextQuery);
		setActiveIndex(0);
		virtualizer.scrollToOffset(0);
	};

	const moveActiveIndex = (nextIndex: number) => {
		const clampedIndex = Math.min(Math.max(nextIndex, 0), matches.length - 1);
		setActiveIndex(clampedIndex);
		virtualizer.scrollToIndex(clampedIndex, { align: 'auto' });
	};

	const removeOption = (option: string) => {
		onChange(value.filter((item) => item !== option));
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			moveActiveIndex(activeIndex + 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			moveActiveIndex(activeIndex - 1);
		} else if (event.key === 'Enter' && activeOption !== undefined) {
			event.preventDefault();
			toggleOption(activeOption);
		} else if (event.key === 'Escape' && query) {
			updateQuery('');
		}
	};

	const activeDescendant = activeOption !== undefined ? optionId(listboxId, activeIndex) : undefined;

	return (
		<>
			{isSearchable && (
				<div className='flex items-center gap-2 border-b px-3'>
					<Search className='size-3.5 shrink-0 text-muted-foreground' />
					<input
						role='combobox'
						aria-expanded
						aria-controls={listboxId}
						aria-activedescendant={activeDescendant}
						aria-label={`Search ${label}`}
						className='h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground'
						placeholder={`Search ${label.toLowerCase()}…`}
						value={query}
						onChange={(event) => updateQuery(event.target.value)}
						onKeyDown={handleKeyDown}
					/>
					{query && (
						<button
							type='button'
							className='rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground'
							aria-label='Clear search'
							onClick={() => updateQuery('')}
						>
							<X className='size-3' />
						</button>
					)}
				</div>
			)}

			<SelectionStrip value={value} onRemove={removeOption} onClear={() => onChange([])} />

			{matches.length === 0 ? (
				<div className='px-3 py-6 text-center text-xs text-muted-foreground'>
					No {label.toLowerCase()} match “{query.trim()}”
				</div>
			) : (
				<div
					ref={listRef}
					id={listboxId}
					role='listbox'
					aria-label={label}
					aria-multiselectable={multiple}
					aria-activedescendant={isSearchable ? undefined : activeDescendant}
					tabIndex={isSearchable ? -1 : 0}
					className='overflow-y-auto px-1 outline-none'
					style={{ height: listHeight(matches.length) }}
					onKeyDown={isSearchable ? undefined : handleKeyDown}
				>
					<div className='relative w-full' style={{ height: virtualizer.getTotalSize() }}>
						{virtualizer.getVirtualItems().map((item) => {
							const option = matches[item.index];
							return (
								<OptionRow
									key={option}
									id={optionId(listboxId, item.index)}
									option={option}
									query={query}
									multiple={multiple}
									isSelected={selected.has(option)}
									isActive={item.index === activeIndex}
									style={{ height: item.size, transform: `translateY(${item.start}px)` }}
									onSelect={() => toggleOption(option)}
									onHover={() => setActiveIndex(item.index)}
								/>
							);
						})}
					</div>
				</div>
			)}

			<PanelFooter
				matchCount={matches.length}
				totalCount={options.length}
				canSelectAll={multiple && matches.some((option) => !selected.has(option))}
				hasQuery={Boolean(query.trim())}
				onSelectAll={selectAllMatches}
			/>
		</>
	);
}

function SelectionStrip({
	value,
	onRemove,
	onClear,
}: {
	value: string[];
	onRemove: (option: string) => void;
	onClear: () => void;
}) {
	if (value.length === 0) {
		return null;
	}

	return (
		<div className='flex items-start gap-2 border-b bg-muted/30 px-2 py-1.5'>
			<div className='flex max-h-14 min-w-0 flex-1 flex-wrap gap-1 overflow-y-auto'>
				{value.map((option) => (
					<span
						key={option}
						className='flex max-w-full items-center gap-0.5 rounded-sm border bg-background py-0.5 pr-0.5 pl-1.5 text-xs'
					>
						<span className='truncate'>{option}</span>
						<button
							type='button'
							className='rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground'
							aria-label={`Remove ${option}`}
							onClick={() => onRemove(option)}
						>
							<X className='size-3' />
						</button>
					</span>
				))}
			</div>
			<button
				type='button'
				className='shrink-0 py-0.5 text-xs text-muted-foreground hover:text-foreground'
				onClick={onClear}
			>
				Clear
			</button>
		</div>
	);
}

function OptionRow({
	id,
	option,
	query,
	multiple,
	isSelected,
	isActive,
	style,
	onSelect,
	onHover,
}: {
	id: string;
	option: string;
	query: string;
	multiple: boolean;
	isSelected: boolean;
	isActive: boolean;
	style: CSSProperties;
	onSelect: () => void;
	onHover: () => void;
}) {
	return (
		<div
			id={id}
			role='option'
			aria-selected={isSelected}
			title={option}
			className={cn(
				'absolute top-0 left-0 flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 text-sm select-none',
				isActive && 'bg-accent text-accent-foreground',
			)}
			style={style}
			onMouseDown={(event) => event.preventDefault()}
			onMouseMove={onHover}
			onClick={onSelect}
		>
			{multiple && <CheckboxIndicator checked={isSelected} />}
			<span className='min-w-0 flex-1 truncate'>
				<HighlightedText text={option} query={query} />
			</span>
			{!multiple && isSelected && <Check className='size-4 shrink-0 text-muted-foreground' />}
		</div>
	);
}

function CheckboxIndicator({ checked }: { checked: boolean }) {
	return (
		<span
			aria-hidden
			className={cn(
				'flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-muted shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]',
				checked && 'bg-brand-gradient text-background shadow-none dark:shadow-none',
			)}
		>
			{checked && <Check className='size-3' />}
		</span>
	);
}

function HighlightedText({ text, query }: { text: string; query: string }) {
	const needle = query.trim().toLowerCase();
	const start = needle ? text.toLowerCase().indexOf(needle) : -1;
	if (start < 0) {
		return <>{text}</>;
	}

	const end = start + needle.length;
	return (
		<>
			{text.slice(0, start)}
			<mark className='bg-transparent font-semibold text-foreground'>{text.slice(start, end)}</mark>
			{text.slice(end)}
		</>
	);
}

function PanelFooter({
	matchCount,
	totalCount,
	canSelectAll,
	hasQuery,
	onSelectAll,
}: {
	matchCount: number;
	totalCount: number;
	canSelectAll: boolean;
	hasQuery: boolean;
	onSelectAll: () => void;
}) {
	return (
		<div className='flex h-8 items-center justify-between gap-2 border-t px-3 text-xs text-muted-foreground'>
			<span>{hasQuery ? `${matchCount} of ${totalCount}` : `${totalCount} options`}</span>
			{canSelectAll && (
				<button type='button' className='font-medium hover:text-foreground' onClick={onSelectAll}>
					{hasQuery ? `Select ${matchCount} matching` : 'Select all'}
				</button>
			)}
		</div>
	);
}

/** Prefix matches rank above substring matches; original order is kept within each group. */
function filterOptions(options: string[], query: string): string[] {
	const needle = query.trim().toLowerCase();
	if (!needle) {
		return options;
	}

	const prefixMatches: string[] = [];
	const substringMatches: string[] = [];
	for (const option of options) {
		const index = option.toLowerCase().indexOf(needle);
		if (index === 0) {
			prefixMatches.push(option);
		} else if (index > 0) {
			substringMatches.push(option);
		}
	}
	return [...prefixMatches, ...substringMatches];
}

function keepOpenWhileSearchHasText(event: globalThis.KeyboardEvent) {
	if (event.target instanceof HTMLInputElement && event.target.value) {
		event.preventDefault();
	}
}

function listHeight(count: number): number {
	return Math.min(count * OPTION_ROW_HEIGHT + LIST_VERTICAL_PADDING * 2, LIST_MAX_HEIGHT);
}

function centeredOffset(index: number): number {
	return Math.max(index * OPTION_ROW_HEIGHT - LIST_MAX_HEIGHT / 2 + OPTION_ROW_HEIGHT, 0);
}

function optionId(listboxId: string, index: number): string {
	return `${listboxId}-option-${index}`;
}
