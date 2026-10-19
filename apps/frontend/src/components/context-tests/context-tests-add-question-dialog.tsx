import { Sparkles } from 'lucide-react';
import { useState } from 'react';

import type { ContextTest } from '@/components/context-tests/context-tests.mock';

import {
	CURRENT_USER_ID,
	allTestTags,
	findOwner,
	slugifyTestName,
	suggestTags,
} from '@/components/context-tests/context-tests.mock';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ContextTestsAddQuestionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onAdd: (test: ContextTest) => void;
}

export function ContextTestsAddQuestionDialog({ open, onOpenChange, onAdd }: ContextTestsAddQuestionDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-xl'>
				{open && <AddQuestionForm onAdd={onAdd} onCancel={() => onOpenChange(false)} />}
			</DialogContent>
		</Dialog>
	);
}

function AddQuestionForm({ onAdd, onCancel }: { onAdd: (test: ContextTest) => void; onCancel: () => void }) {
	const [prompt, setPrompt] = useState('');
	const [customName, setCustomName] = useState<string | null>(null);
	const [expectedSql, setExpectedSql] = useState('');
	const [chosenTags, setChosenTags] = useState<string[] | null>(null);

	const suggestedTags = suggestTags(prompt);
	const tags = chosenTags ?? suggestedTags;
	const name = customName ?? slugifyTestName(prompt);
	const canSubmit = prompt.trim().length > 0 && name.length > 0;

	const toggleTag = (tag: string) =>
		setChosenTags(tags.includes(tag) ? tags.filter((current) => current !== tag) : [...tags, tag]);

	const submit = () => {
		onAdd({
			id: `draft-${name}-${Date.now()}`,
			name,
			prompt: prompt.trim(),
			expectedSql: expectedSql.trim() || undefined,
			tags,
			ownerId: CURRENT_USER_ID,
			readsFiles: [],
			productionPassRate: null,
			isDraft: true,
		});
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle>Add a test question</DialogTitle>
				<DialogDescription>
					It joins this run as a draft. Save it to the suite from the results once you are happy with it.
				</DialogDescription>
			</DialogHeader>

			<div className='flex flex-col gap-4'>
				<Field label='Question'>
					<Textarea
						autoFocus
						value={prompt}
						onChange={(event) => setPrompt(event.target.value)}
						placeholder='Ask it the way a business user would, e.g. "What was gross revenue by channel in Q3?"'
						className='min-h-20'
					/>
				</Field>

				<Field label='Test name'>
					<Input
						value={name}
						onChange={(event) => setCustomName(event.target.value)}
						placeholder='revenue_by_channel_q3'
						className='font-mono text-sm'
					/>
				</Field>

				<Field
					label='Expected answer'
					hint='Optional. Without a query, the first answer you approve becomes the expected result.'
				>
					<Textarea
						value={expectedSql}
						onChange={(event) => setExpectedSql(event.target.value)}
						placeholder='SELECT channel, SUM(amount) FROM orders ...'
						className='min-h-16 font-mono text-xs'
					/>
				</Field>

				<div className='flex flex-col gap-1.5'>
					<span className='text-sm font-medium'>Tags</span>
					<div className='flex flex-wrap gap-1.5'>
						{allTestTags.map((tag) => {
							const isChosen = tags.includes(tag);
							const isSuggested = chosenTags === null && suggestedTags.includes(tag);
							return (
								<button
									key={tag}
									type='button'
									onClick={() => toggleTag(tag)}
									className={cn(
										'flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
										isChosen
											? 'border-primary bg-primary/10 text-primary'
											: 'text-muted-foreground hover:bg-accent',
									)}
								>
									{isSuggested && <Sparkles className='size-3' />}
									{tag}
								</button>
							);
						})}
					</div>
				</div>

				<div className='text-xs text-muted-foreground'>
					Owner: <span className='text-foreground'>{findOwner(CURRENT_USER_ID).name}</span> (you)
				</div>
			</div>

			<DialogFooter>
				<Button variant='ghost' onClick={onCancel}>
					Cancel
				</Button>
				<Button onClick={submit} disabled={!canSubmit}>
					Add to this run
				</Button>
			</DialogFooter>
		</>
	);
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
	return (
		<label className='flex flex-col gap-1.5'>
			<span className='text-sm font-medium'>{label}</span>
			{children}
			{hint && <span className='text-xs text-muted-foreground'>{hint}</span>}
		</label>
	);
}
