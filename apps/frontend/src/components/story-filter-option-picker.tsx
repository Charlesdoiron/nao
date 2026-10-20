import { CheckIcon, ChevronsUpDown, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { isMac } from '@/lib/platform';
import { cn } from '@/lib/utils';

export const EXPANDED_PICKER_MIN_OPTIONS = 15;

const ALL_OPTION_VALUE = '__nao_filter_all__';
const OTHER_INITIAL = '#';
const ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', OTHER_INITIAL];

interface OptionGroup {
	initial: string;
	options: string[];
}

export function StoryFilterOptionPicker({
	label,
	options,
	multiple,
	value,
	onChange,
}: {
	label: string;
	options: string[];
	multiple: boolean;
	value: string[];
	onChange: (value: string[]) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [initialQuery, setInitialQuery] = useState('');

	const openWithQuery = (query: string) => {
		setInitialQuery(query);
		setIsOpen(true);
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<PickerTrigger value={value} onOpen={openWithQuery} />
			<DialogContent
				showCloseButton={false}
				className={cn(
					'flex h-[min(680px,85vh)] flex-col gap-0 overflow-hidden rounded-2xl p-0',
					multiple ? 'sm:max-w-3xl' : 'sm:max-w-xl',
				)}
			>
				<PickerPanel
					label={label}
					options={options}
					multiple={multiple}
					value={value}
					initialQuery={initialQuery}
					onChange={onChange}
					onClose={() => setIsOpen(false)}
				/>
			</DialogContent>
		</Dialog>
	);
}

function PickerTrigger({ value, onOpen }: { value: string[]; onOpen: (initialQuery: string) => void }) {
	const openOnTyping = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (isPrintableKey(event)) {
			event.preventDefault();
			onOpen(event.key);
		}
	};

	return (
		<Button
			variant='outline'
			size='sm'
			aria-haspopup='dialog'
			title={value.length > 1 ? value.join(', ') : undefined}
			className='h-8 min-w-36 max-w-64 justify-between gap-2 bg-background font-normal'
			onClick={() => onOpen('')}
			onKeyDown={openOnTyping}
		>
			<span className='truncate'>{summarizeSelection(value)}</span>
			<ChevronsUpDown className='size-3.5 shrink-0 opacity-50' />
		</Button>
	);
}

function PickerPanel({
	label,
	options,
	multiple,
	value,
	initialQuery,
	onChange,
	onClose,
}: {
	label: string;
	options: string[];
	multiple: boolean;
	value: string[];
	initialQuery: string;
	onChange: (value: string[]) => void;
	onClose: () => void;
}) {
	const [query, setQuery] = useState(initialQuery);
	const [draft, setDraft] = useState(value);
	const [highlighted, setHighlighted] = useState('');
	const listRef = useRef<HTMLDivElement>(null);

	const visibleOptions = useMemo(() => filterOptions(options, query), [options, query]);
	const groups = useMemo(() => groupByInitial(visibleOptions), [visibleOptions]);
	const draftSet = useMemo(() => new Set(draft), [draft]);
	const isSearching = query.trim().length > 0;

	const selectOption = (option: string) => {
		if (!multiple) {
			onChange(option === ALL_OPTION_VALUE ? [] : [option]);
			onClose();
			return;
		}
		setDraft((current) =>
			current.includes(option) ? current.filter((candidate) => candidate !== option) : [...current, option],
		);
	};

	const applyDraft = () => {
		onChange(draft);
		onClose();
	};

	const selectVisible = () => setDraft((current) => [...new Set([...current, ...visibleOptions])]);

	const deselectVisible = () => {
		const visible = new Set(visibleOptions);
		setDraft((current) => current.filter((option) => !visible.has(option)));
	};

	const jumpToInitial = (initial: string) => {
		const group = groups.find((candidate) => candidate.initial === initial);
		if (!group) {
			return;
		}
		setHighlighted(group.options[0]);
		listRef.current
			?.querySelector(`[data-initial="${initial}"]`)
			?.scrollIntoView({ block: 'start', behavior: 'smooth' });
	};

	const applyOnModEnter = (event: KeyboardEvent<HTMLDivElement>) => {
		if (multiple && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			applyDraft();
		}
	};

	return (
		<>
			<PickerHeader label={label} optionCount={options.length} multiple={multiple} />
			<Command
				shouldFilter={false}
				value={highlighted}
				onValueChange={setHighlighted}
				onKeyDown={applyOnModEnter}
				className='min-h-0 flex-1 rounded-none **:data-[slot=command-input-wrapper]:h-12 **:data-[slot=command-input-wrapper]:px-5'
			>
				<CommandInput
					autoFocus
					value={query}
					onValueChange={setQuery}
					placeholder={`Search ${options.length} ${label.toLowerCase()} values…`}
				/>
				<div className='flex min-h-0 flex-1'>
					<div className='flex min-w-0 flex-1 flex-col'>
						<ListToolbar
							visibleCount={visibleOptions.length}
							totalCount={options.length}
							isSearching={isSearching}
							multiple={multiple}
							onSelectVisible={selectVisible}
							onDeselectVisible={deselectVisible}
						/>
						<div className='flex min-h-0 flex-1'>
							<CommandList
								ref={listRef}
								className='max-h-none flex-1 px-2 pb-2 **:[[cmdk-group-heading]]:sticky **:[[cmdk-group-heading]]:top-0 **:[[cmdk-group-heading]]:z-10 **:[[cmdk-group-heading]]:bg-background'
							>
								<CommandEmpty className='py-10 text-center text-sm text-muted-foreground'>
									No values match “{query.trim()}”
								</CommandEmpty>
								{!multiple && !isSearching && (
									<CommandGroup className='overflow-visible'>
										<CommandItem
											value={ALL_OPTION_VALUE}
											onSelect={() => selectOption(ALL_OPTION_VALUE)}
											className='gap-3 py-2'
										>
											<SingleSelectIndicator checked={value.length === 0} />
											<span className='text-muted-foreground'>All values</span>
										</CommandItem>
									</CommandGroup>
								)}
								{groups.map((group) => (
									<CommandGroup
										key={group.initial}
										heading={group.initial}
										data-initial={group.initial}
										className='overflow-visible'
									>
										{group.options.map((option) => (
											<CommandItem
												key={option}
												value={option}
												onSelect={() => selectOption(option)}
												className='gap-3 py-2'
											>
												{multiple ? (
													<CheckboxIndicator checked={draftSet.has(option)} />
												) : (
													<SingleSelectIndicator checked={value[0] === option} />
												)}
												<HighlightedText text={option} query={query} />
											</CommandItem>
										))}
									</CommandGroup>
								))}
							</CommandList>
							{!isSearching && groups.length > 1 && (
								<InitialRail
									availableInitials={new Set(groups.map((group) => group.initial))}
									onJump={jumpToInitial}
								/>
							)}
						</div>
					</div>
					{multiple && (
						<SelectedPanel selected={draft} onRemove={selectOption} onClear={() => setDraft([])} />
					)}
				</div>
			</Command>
			<PickerFooter
				multiple={multiple}
				selectedCount={draft.length}
				hasChanges={!areSameValues(draft, value)}
				onCancel={onClose}
				onApply={applyDraft}
			/>
		</>
	);
}

function PickerHeader({ label, optionCount, multiple }: { label: string; optionCount: number; multiple: boolean }) {
	return (
		<div className='flex items-start justify-between gap-4 border-b px-5 py-4'>
			<div className='flex flex-col gap-1'>
				<DialogTitle className='text-base'>{label}</DialogTitle>
				<DialogDescription className='text-xs'>
					{multiple ? 'Pick one or more values' : 'Pick a value'} to filter the whole story · {optionCount}{' '}
					options
				</DialogDescription>
			</div>
			<DialogClose className='rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'>
				<X className='size-4' />
				<span className='sr-only'>Close</span>
			</DialogClose>
		</div>
	);
}

function ListToolbar({
	visibleCount,
	totalCount,
	isSearching,
	multiple,
	onSelectVisible,
	onDeselectVisible,
}: {
	visibleCount: number;
	totalCount: number;
	isSearching: boolean;
	multiple: boolean;
	onSelectVisible: () => void;
	onDeselectVisible: () => void;
}) {
	return (
		<div className='flex h-9 shrink-0 items-center justify-between gap-2 px-5 text-xs text-muted-foreground'>
			<span className='tabular-nums'>
				{isSearching ? `${visibleCount} of ${totalCount} match` : `${totalCount} values`}
			</span>
			{multiple && visibleCount > 0 && (
				<div className='flex items-center gap-3'>
					<button type='button' className='hover:text-foreground' onClick={onSelectVisible}>
						{isSearching ? `Select ${visibleCount} matches` : 'Select all'}
					</button>
					<button type='button' className='hover:text-foreground' onClick={onDeselectVisible}>
						{isSearching ? 'Deselect matches' : 'Deselect all'}
					</button>
				</div>
			)}
		</div>
	);
}

function InitialRail({
	availableInitials,
	onJump,
}: {
	availableInitials: Set<string>;
	onJump: (initial: string) => void;
}) {
	return (
		<nav aria-label='Jump to letter' className='flex w-7 shrink-0 flex-col justify-center py-2'>
			{ALPHABET.map((initial) => (
				<button
					key={initial}
					type='button'
					tabIndex={-1}
					disabled={!availableInitials.has(initial)}
					onClick={() => onJump(initial)}
					className='flex max-h-5 min-h-0 w-full flex-1 items-center justify-center rounded-sm text-[10px] leading-none font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30'
				>
					{initial}
				</button>
			))}
		</nav>
	);
}

function SelectedPanel({
	selected,
	onRemove,
	onClear,
}: {
	selected: string[];
	onRemove: (option: string) => void;
	onClear: () => void;
}) {
	return (
		<aside className='flex w-64 shrink-0 flex-col border-l bg-muted/20'>
			<div className='flex h-9 shrink-0 items-center justify-between px-4 text-xs'>
				<span className='font-medium'>
					Selected <span className='text-muted-foreground tabular-nums'>{selected.length}</span>
				</span>
				{selected.length > 0 && (
					<button type='button' className='text-muted-foreground hover:text-foreground' onClick={onClear}>
						Clear
					</button>
				)}
			</div>
			{selected.length === 0 ? (
				<p className='px-4 text-xs leading-relaxed text-muted-foreground'>
					Nothing selected yet. The story shows every value until you pick some.
				</p>
			) : (
				<ul className='flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2'>
					{selected.map((option) => (
						<li
							key={option}
							className='group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted'
						>
							<span className='truncate'>{option}</span>
							<button
								type='button'
								tabIndex={-1}
								aria-label={`Remove ${option}`}
								className='rounded-sm p-0.5 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 hover:text-foreground'
								onClick={() => onRemove(option)}
							>
								<X className='size-3.5' />
							</button>
						</li>
					))}
				</ul>
			)}
		</aside>
	);
}

function PickerFooter({
	multiple,
	selectedCount,
	hasChanges,
	onCancel,
	onApply,
}: {
	multiple: boolean;
	selectedCount: number;
	hasChanges: boolean;
	onCancel: () => void;
	onApply: () => void;
}) {
	return (
		<div className='flex h-14 shrink-0 items-center justify-between gap-4 border-t px-5'>
			<div className='flex items-center gap-3 text-xs text-muted-foreground'>
				<span className='flex items-center gap-1.5'>
					<Kbd keys={['↑', '↓']} /> Navigate
				</span>
				<span className='flex items-center gap-1.5'>
					<Kbd keys={['↵']} /> {multiple ? 'Toggle' : 'Select'}
				</span>
				{multiple && (
					<span className='flex items-center gap-1.5'>
						<Kbd keys={[isMac ? '⌘' : 'Ctrl', '↵']} /> Apply
					</span>
				)}
				<span className='flex items-center gap-1.5'>
					<Kbd keys={['Esc']} /> Close
				</span>
			</div>
			{multiple && (
				<div className='flex items-center gap-2'>
					<Button variant='ghost' size='sm' onClick={onCancel}>
						Cancel
					</Button>
					<Button size='sm' disabled={!hasChanges} onClick={onApply}>
						{selectedCount > 0 ? `Apply ${selectedCount} selected` : 'Show all values'}
					</Button>
				</div>
			)}
		</div>
	);
}

function CheckboxIndicator({ checked }: { checked: boolean }) {
	return (
		<span
			aria-hidden
			className={cn(
				'flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-muted shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]',
				checked && 'bg-brand-gradient shadow-none dark:shadow-none',
			)}
		>
			{checked && <CheckIcon className='size-3 text-background' />}
		</span>
	);
}

function SingleSelectIndicator({ checked }: { checked: boolean }) {
	return <CheckIcon className={cn('size-4 text-foreground', !checked && 'invisible')} />;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
	const needle = query.trim().toLowerCase();
	const start = needle ? text.toLowerCase().indexOf(needle) : -1;
	if (start < 0) {
		return <span className='truncate'>{text}</span>;
	}
	const end = start + needle.length;
	return (
		<span className='truncate'>
			{text.slice(0, start)}
			<mark className='rounded-sm bg-amber-200/70 text-foreground dark:bg-amber-500/30'>
				{text.slice(start, end)}
			</mark>
			{text.slice(end)}
		</span>
	);
}

function summarizeSelection(value: string[]): string {
	if (value.length === 0) {
		return 'All';
	}
	if (value.length === 1) {
		return value[0];
	}
	return `${value[0]} +${value.length - 1}`;
}

function filterOptions(options: string[], query: string): string[] {
	const needle = query.trim().toLowerCase();
	return needle ? options.filter((option) => option.toLowerCase().includes(needle)) : options;
}

function groupByInitial(options: string[]): OptionGroup[] {
	const groups = new Map<string, string[]>();
	const sorted = [...options].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
	for (const option of sorted) {
		const initial = getInitial(option);
		const group = groups.get(initial);
		if (group) {
			group.push(option);
		} else {
			groups.set(initial, [option]);
		}
	}
	return ALPHABET.filter((initial) => groups.has(initial)).map((initial) => ({
		initial,
		options: groups.get(initial) ?? [],
	}));
}

function getInitial(option: string): string {
	const initial = option
		.trim()
		.charAt(0)
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toUpperCase();
	return /^[A-Z]$/.test(initial) ? initial : OTHER_INITIAL;
}

function isPrintableKey(event: KeyboardEvent): boolean {
	return event.key.length === 1 && event.key !== ' ' && !event.metaKey && !event.ctrlKey && !event.altKey;
}

function areSameValues(left: string[], right: string[]): boolean {
	return left.length === right.length && left.every((option) => right.includes(option));
}
