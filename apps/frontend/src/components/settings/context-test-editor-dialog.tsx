import { Plus, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { ContextTest, TestOwner } from '@/lib/context-tests';
import { TagChip } from '@/components/settings/context-test-reliability';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { suggestTags, toTestName } from '@/lib/context-tests';
import { contextTestsStore, useContextTests } from '@/stores/context-tests';

export type TestEditorDefaults = Partial<Pick<ContextTest, 'prompt' | 'sql' | 'tags' | 'tables'>>;

interface ContextTestEditorDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	test?: ContextTest;
	defaults?: TestEditorDefaults;
	branch: string;
	currentOwner: TestOwner;
	onSaved?: (test: ContextTest) => void;
}

export function ContextTestEditorDialog({ open, onOpenChange, ...formProps }: ContextTestEditorDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-xl'>
				{open && <TestEditorForm {...formProps} onClose={() => onOpenChange(false)} />}
			</DialogContent>
		</Dialog>
	);
}

function TestEditorForm({
	test,
	defaults,
	branch,
	currentOwner,
	onSaved,
	onClose,
}: Omit<ContextTestEditorDialogProps, 'open' | 'onOpenChange'> & { onClose: () => void }) {
	const { owners } = useContextTests();
	const [prompt, setPrompt] = useState(test?.prompt ?? defaults?.prompt ?? '');
	const [customName, setCustomName] = useState<string | null>(test?.name ?? null);
	const [sql, setSql] = useState(test?.sql ?? defaults?.sql ?? '');
	const [tags, setTags] = useState<string[]>(test?.tags ?? defaults?.tags ?? []);
	const [tagInput, setTagInput] = useState('');
	const [ownerId, setOwnerId] = useState(test?.ownerId ?? currentOwner.id);
	const ownerOptions = useMemo(
		() => (owners.some((owner) => owner.id === currentOwner.id) ? owners : [currentOwner, ...owners]),
		[owners, currentOwner],
	);
	const name = customName ?? toTestName(prompt);
	const suggestedTags = suggestTags(sql, prompt).filter((tag) => !tags.includes(tag));
	const canSave = prompt.trim().length > 0 && sql.trim().length > 0 && name.length > 0;

	const addTag = (tag: string) => {
		const normalizedTag = tag.trim().toLowerCase().replace(/\s+/g, '-');
		if (normalizedTag && !tags.includes(normalizedTag)) {
			setTags([...tags, normalizedTag]);
		}
		setTagInput('');
	};

	const handleSave = () => {
		const savedTest: ContextTest = {
			id: test?.id ?? `${name}-${Date.now()}`,
			name,
			prompt: prompt.trim(),
			sql: sql.trim(),
			tags,
			ownerId,
			branch: test?.branch ?? branch,
			tables: test?.tables ?? defaults?.tables ?? suggestTags(sql, ''),
			baseline: test?.baseline ?? null,
		};
		contextTestsStore.ensureOwner(currentOwner);
		contextTestsStore.saveTest(savedTest);
		onSaved?.(savedTest);
		onClose();
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle>{test ? 'Edit test' : 'New test'}</DialogTitle>
				<DialogDescription>
					A question the agent should answer, and the SQL that produces the right answer.
				</DialogDescription>
			</DialogHeader>

			<div className='grid min-w-0 gap-4'>
				<div className='grid gap-2'>
					<label htmlFor='test-prompt' className='text-sm font-medium text-foreground'>
						Question
					</label>
					<Textarea
						id='test-prompt'
						placeholder='What share of orders were returned last quarter?'
						value={prompt}
						onChange={(event) => setPrompt(event.target.value)}
						className='min-h-16 field-sizing-fixed'
					/>
				</div>

				<div className='grid gap-2'>
					<label htmlFor='test-name' className='text-sm font-medium text-foreground'>
						Name
					</label>
					<Input
						id='test-name'
						className='font-mono text-xs'
						placeholder='orders_refund_rate'
						value={name}
						onChange={(event) => setCustomName(event.target.value)}
					/>
				</div>

				<div className='grid gap-2'>
					<label htmlFor='test-sql' className='text-sm font-medium text-foreground'>
						Expected SQL
					</label>
					<Textarea
						id='test-sql'
						className='min-h-24 field-sizing-fixed font-mono text-xs'
						placeholder='SELECT …'
						value={sql}
						onChange={(event) => setSql(event.target.value)}
					/>
				</div>

				<div className='grid grid-cols-[minmax(0,1fr)_200px] gap-4'>
					<div className='grid gap-2 content-start'>
						<label htmlFor='test-tag-input' className='text-sm font-medium text-foreground'>
							Tags
						</label>
						<div className='flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input px-2 py-1.5'>
							{tags.map((tag) => (
								<span
									key={tag}
									className='inline-flex h-5 items-center gap-1 rounded-md bg-muted px-1.5 text-[11px]'
								>
									{tag}
									<button
										type='button'
										aria-label={`Remove ${tag}`}
										onClick={() => setTags(tags.filter((existing) => existing !== tag))}
										className='text-muted-foreground hover:text-foreground'
									>
										<X className='size-3' />
									</button>
								</span>
							))}
							<input
								id='test-tag-input'
								value={tagInput}
								onChange={(event) => setTagInput(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === 'Enter' || event.key === ',') {
										event.preventDefault();
										addTag(tagInput);
									}
								}}
								placeholder={tags.length === 0 ? 'Add a tag…' : ''}
								className='min-w-16 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground'
							/>
						</div>
						{suggestedTags.length > 0 && (
							<div className='flex flex-wrap items-center gap-1 text-xs text-muted-foreground'>
								<Sparkles className='size-3' />
								<span>Suggested</span>
								{suggestedTags.map((tag) => (
									<button
										key={tag}
										type='button'
										onClick={() => addTag(tag)}
										className='inline-flex h-5 items-center gap-0.5 rounded-md border border-dashed border-border px-1.5 text-[11px] hover:border-primary/40 hover:text-foreground'
									>
										<Plus className='size-2.5' />
										{tag}
									</button>
								))}
							</div>
						)}
					</div>

					<div className='grid gap-2 content-start'>
						<span className='text-sm font-medium text-foreground'>Owner</span>
						<Select value={ownerId} onValueChange={setOwnerId}>
							<SelectTrigger className='w-full'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ownerOptions.map((owner) => (
									<SelectItem key={owner.id} value={owner.id}>
										{owner.id === currentOwner.id ? `${owner.name} (you)` : owner.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>

			<div className='flex items-center gap-2 pt-2'>
				<p className='min-w-0 flex-1 truncate text-xs text-muted-foreground'>
					Saved as <span className='font-mono'>tests/{name || '…'}.yml</span> on{' '}
					<TagChip tag={test?.branch ?? branch} />
				</p>
				<Button variant='ghost' size='sm' onClick={onClose} type='button'>
					Cancel
				</Button>
				<Button size='sm' onClick={handleSave} type='button' disabled={!canSave}>
					{test ? 'Save changes' : 'Add test'}
				</Button>
			</div>
		</>
	);
}
