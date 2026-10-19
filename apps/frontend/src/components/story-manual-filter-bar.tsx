import { ArrowLeft, CalendarDays, ChevronDown, ListFilter, Plus, Sparkles, Tag, X } from 'lucide-react';
import { pluralize } from '@nao/shared';
import { useState } from 'react';

import type { QueryDataMap } from '@/components/story-embeds';
import type { ManualFilter, ManualFilterField, StoryBlockRef } from '@/lib/story-manual-filters';
import { StoryManualFilterEditor } from '@/components/story-manual-filter-editor';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
	createDraftFilter,
	describeFilterValue,
	getDefaultTargets,
	isManualFilterActive,
} from '@/lib/story-manual-filters';

interface StoryManualFilterBarProps {
	fields: ManualFilterField[];
	blocks: StoryBlockRef[];
	filters: ManualFilter[];
	queryData: QueryDataMap | null;
	onAdd: (filter: ManualFilter) => void;
	onUpdate: (filter: ManualFilter) => void;
	onRemove: (filterId: string) => void;
	onClear: () => void;
}

export function StoryManualFilterBar({
	fields,
	blocks,
	filters,
	queryData,
	onAdd,
	onUpdate,
	onRemove,
	onClear,
}: StoryManualFilterBarProps) {
	if (fields.length === 0) {
		return null;
	}

	return (
		<div className='sticky top-0 z-20 -my-2 bg-background py-2'>
			<div className='flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border bg-background px-2 py-1.5 shadow-xs'>
				<ListFilter className='mx-1 size-3.5 shrink-0 text-muted-foreground' />
				{filters.map((filter) => (
					<FilterChip
						key={filter.id}
						filter={filter}
						blocks={blocks}
						queryData={queryData}
						onUpdate={onUpdate}
						onRemove={() => onRemove(filter.id)}
					/>
				))}
				<AddFilterPopover fields={fields} blocks={blocks} queryData={queryData} onAdd={onAdd} />
				{filters.length === 0 ? (
					<span className='truncate text-xs text-muted-foreground'>
						{`Filter by ${fields
							.slice(0, 3)
							.map((field) => field.label)
							.join(', ')}…`}
					</span>
				) : (
					<Button variant='ghost-muted' size='sm' className='ml-auto h-7 text-xs' onClick={onClear}>
						Clear all
					</Button>
				)}
			</div>
		</div>
	);
}

function FilterChip({
	filter,
	blocks,
	queryData,
	onUpdate,
	onRemove,
}: {
	filter: ManualFilter;
	blocks: StoryBlockRef[];
	queryData: QueryDataMap | null;
	onUpdate: (filter: ManualFilter) => void;
	onRemove: () => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const Icon = filter.kind === 'date' ? CalendarDays : Tag;
	const isActive = isManualFilterActive(filter);

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverAnchor asChild>
				<div
					data-active={isActive}
					className='inline-flex h-7 items-center rounded-full border bg-muted/50 pl-2.5 pr-0.5 text-xs data-[active=false]:border-dashed data-[active=false]:bg-transparent'
				>
					<PopoverTrigger asChild>
						<button type='button' className='flex items-center gap-1.5 outline-none'>
							<Icon className='size-3 text-muted-foreground' />
							<span className='text-muted-foreground'>{filter.label}</span>
							<span className='font-medium'>{describeFilterValue(filter)}</span>
							<ChevronDown className='size-3 text-muted-foreground' />
						</button>
					</PopoverTrigger>
					<button
						type='button'
						aria-label={`Remove ${filter.label} filter`}
						className='ml-1 rounded-full p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground'
						onClick={onRemove}
					>
						<X className='size-3' />
					</button>
				</div>
			</PopoverAnchor>
			<PopoverContent align='start' className='w-80 p-0'>
				<PopoverHeader title={filter.label} subtitle={describeTargets(filter)} />
				<div className='max-h-[60vh] overflow-y-auto p-3'>
					<StoryManualFilterEditor
						filter={filter}
						blocks={blocks}
						queryData={queryData}
						onChange={onUpdate}
					/>
				</div>
				<div className='flex items-center justify-between gap-2 border-t px-3 py-2'>
					<Button variant='destructive-soft' size='sm' className='h-7 text-xs' onClick={onRemove}>
						Remove filter
					</Button>
					<Button size='sm' className='h-7 text-xs' onClick={() => setIsOpen(false)}>
						Done
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function AddFilterPopover({
	fields,
	blocks,
	queryData,
	onAdd,
}: {
	fields: ManualFilterField[];
	blocks: StoryBlockRef[];
	queryData: QueryDataMap | null;
	onAdd: (filter: ManualFilter) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [draft, setDraft] = useState<ManualFilter | null>(null);

	const close = () => {
		setIsOpen(false);
		setDraft(null);
	};

	return (
		<Popover open={isOpen} onOpenChange={(open) => (open ? setIsOpen(true) : close())}>
			<PopoverTrigger asChild>
				<Button variant='ghost-muted' size='sm' className='h-7 gap-1 rounded-full px-2.5 text-xs'>
					<Plus className='size-3.5' />
					Add filter
				</Button>
			</PopoverTrigger>
			<PopoverContent align='start' className='w-80 p-0'>
				{draft ? (
					<>
						<PopoverHeader
							title={draft.label}
							subtitle={describeTargets(draft)}
							onBack={() => setDraft(null)}
						/>
						<div className='max-h-[60vh] overflow-y-auto p-3'>
							<StoryManualFilterEditor
								filter={draft}
								blocks={blocks}
								queryData={queryData}
								onChange={setDraft}
							/>
						</div>
						<div className='flex justify-end gap-2 border-t px-3 py-2'>
							<Button variant='ghost' size='sm' className='h-7 text-xs' onClick={close}>
								Cancel
							</Button>
							<Button
								size='sm'
								className='h-7 text-xs'
								disabled={!isManualFilterActive(draft)}
								onClick={() => {
									onAdd(draft);
									close();
								}}
							>
								Add filter
							</Button>
						</div>
					</>
				) : (
					<FieldPicker
						fields={fields}
						blocks={blocks}
						queryData={queryData}
						onSelect={(field) =>
							setDraft(createDraftFilter(field, getDefaultTargets(field, blocks, queryData)))
						}
					/>
				)}
			</PopoverContent>
		</Popover>
	);
}

function FieldPicker({
	fields,
	blocks,
	queryData,
	onSelect,
}: {
	fields: ManualFilterField[];
	blocks: StoryBlockRef[];
	queryData: QueryDataMap | null;
	onSelect: (field: ManualFilterField) => void;
}) {
	const groups = [
		{ heading: 'Dates', icon: CalendarDays, fields: fields.filter((field) => field.kind === 'date') },
		{ heading: 'Categories', icon: Tag, fields: fields.filter((field) => field.kind === 'category') },
	].filter((group) => group.fields.length > 0);

	return (
		<Command>
			<CommandInput placeholder='Filter by…' className='text-xs' />
			<CommandList className='max-h-72'>
				<CommandEmpty className='py-4 text-center text-xs text-muted-foreground'>
					No matching field
				</CommandEmpty>
				{groups.map((group) => (
					<CommandGroup key={group.heading} heading={group.heading}>
						{group.fields.map((field) => {
							const targetCount = getDefaultTargets(field, blocks, queryData).length;
							return (
								<CommandItem
									key={`${field.kind}:${field.column}`}
									value={`${field.kind}:${field.label}`}
									className='text-xs'
									onSelect={() => onSelect(field)}
								>
									<group.icon className='size-3.5' />
									<span className='flex-1 truncate'>{field.label}</span>
									<span className='text-[11px] text-muted-foreground'>
										{targetCount} {pluralize('chart', targetCount)}
									</span>
								</CommandItem>
							);
						})}
					</CommandGroup>
				))}
			</CommandList>
			<div className='flex items-start gap-1.5 border-t px-3 py-2 text-[11px] leading-snug text-muted-foreground'>
				<Sparkles className='mt-0.5 size-3 shrink-0' />
				Fields come from the columns of this story's charts. Ask the agent for anything more advanced.
			</div>
		</Command>
	);
}

function PopoverHeader({ title, subtitle, onBack }: { title: string; subtitle: string; onBack?: () => void }) {
	return (
		<div className='flex items-center gap-1.5 border-b px-2 py-1.5'>
			{onBack ? (
				<Button variant='ghost-muted' size='icon-xs' onClick={onBack} aria-label='Back to fields'>
					<ArrowLeft className='size-3.5' />
				</Button>
			) : (
				<span className='w-1' />
			)}
			<span className='text-sm font-medium'>{title}</span>
			<span className='ml-auto pr-1 text-[11px] text-muted-foreground'>{subtitle}</span>
		</div>
	);
}

function describeTargets(filter: ManualFilter): string {
	const count = filter.targets.length;
	return `${count} ${pluralize('chart', count)}`;
}
