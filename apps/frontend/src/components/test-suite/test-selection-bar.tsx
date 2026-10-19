import { Play, Tag, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function TestSelectionBar({
	count,
	existingTags,
	onRun,
	onAddTag,
	onDelete,
	onClear,
}: {
	count: number;
	existingTags: string[];
	onRun: () => void;
	onAddTag: (tag: string) => void;
	onDelete: () => void;
	onClear: () => void;
}) {
	if (count === 0) {
		return null;
	}

	return (
		<div className='pointer-events-none sticky bottom-6 z-20 flex justify-center'>
			<div className='pointer-events-auto flex items-center gap-1 rounded-full border bg-background px-2 py-1.5 shadow-lg'>
				<span className='px-2 text-sm font-medium tabular-nums'>{count} selected</span>
				<div className='mx-1 h-4 w-px bg-border' />
				<Button variant='ghost' size='sm' className='rounded-full' onClick={onRun}>
					<Play />
					Run selected
				</Button>
				<AddTagPopover existingTags={existingTags} onAddTag={onAddTag} />
				<Button variant='ghost' size='sm' className='rounded-full text-destructive' onClick={onDelete}>
					<Trash2 />
					Delete
				</Button>
				<Button
					variant='ghost-muted'
					size='icon-sm'
					className='rounded-full'
					onClick={onClear}
					aria-label='Clear selection'
				>
					<X />
				</Button>
			</div>
		</div>
	);
}

function AddTagPopover({ existingTags, onAddTag }: { existingTags: string[]; onAddTag: (tag: string) => void }) {
	const [open, setOpen] = useState(false);
	const [value, setValue] = useState('');

	function apply(tag: string) {
		const normalized = tag.trim().toLowerCase();
		if (!normalized) {
			return;
		}
		onAddTag(normalized);
		setValue('');
		setOpen(false);
	}

	function handleSubmit(event: FormEvent) {
		event.preventDefault();
		apply(value);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant='ghost' size='sm' className='rounded-full'>
					<Tag />
					Add tag
				</Button>
			</PopoverTrigger>
			<PopoverContent side='top' className='w-64 p-3'>
				<form onSubmit={handleSubmit}>
					<Input
						autoFocus
						value={value}
						onChange={(event) => setValue(event.target.value)}
						placeholder='New or existing tag'
						className='h-8'
					/>
				</form>
				<div className='mt-2 flex flex-wrap gap-1'>
					{existingTags.map((tag) => (
						<button
							key={tag}
							type='button'
							onClick={() => apply(tag)}
							className='cursor-pointer rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground/80 hover:bg-accent'
						>
							{tag}
						</button>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}
