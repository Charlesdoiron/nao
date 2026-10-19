import { GitBranch, Plus, X } from 'lucide-react';
import { useState } from 'react';

import { OWNERS } from './test-suite-mock-data';
import { inferTagsFromName, toTestFilePath } from './test-suite-utils';
import type { KeyboardEvent, ReactNode } from 'react';
import type { GitRef, SuiteTest, TestDraft } from './test-suite-types';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export interface TestEditorSubmit {
	draft: TestDraft;
	refId: string;
	runAfterSave: boolean;
}

export function TestEditorDialog({
	open,
	onOpenChange,
	test,
	branches,
	defaultRefId,
	defaultOwner,
	runsPerTest,
	onSubmit,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	test: SuiteTest | null;
	branches: GitRef[];
	defaultRefId: string;
	defaultOwner: string;
	runsPerTest: number;
	onSubmit: (value: TestEditorSubmit) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='gap-5 sm:max-w-2xl'>
				{open && (
					<TestEditorForm
						key={test?.id ?? 'new'}
						test={test}
						branches={branches}
						defaultRefId={defaultRefId}
						defaultOwner={defaultOwner}
						runsPerTest={runsPerTest}
						onCancel={() => onOpenChange(false)}
						onSubmit={onSubmit}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

function TestEditorForm({
	test,
	branches,
	defaultRefId,
	defaultOwner,
	runsPerTest,
	onCancel,
	onSubmit,
}: {
	test: SuiteTest | null;
	branches: GitRef[];
	defaultRefId: string;
	defaultOwner: string;
	runsPerTest: number;
	onCancel: () => void;
	onSubmit: (value: TestEditorSubmit) => void;
}) {
	const [draft, setDraft] = useState<TestDraft>(() => ({
		name: test?.name ?? '',
		prompt: test?.prompt ?? '',
		sql: test?.sql ?? '',
		tags: test?.tags ?? [],
		owner: test?.owner ?? defaultOwner,
	}));
	const [refId, setRefId] = useState(defaultRefId);
	const [runAfterSave, setRunAfterSave] = useState(true);
	const suggestedTags = inferTagsFromName(draft.name).filter((tag) => !draft.tags.includes(tag));
	const targetRef = branches.find((ref) => ref.id === refId);
	const canSave = draft.name.trim() !== '' && draft.prompt.trim() !== '';

	function update<Key extends keyof TestDraft>(key: Key, value: TestDraft[Key]) {
		setDraft((current) => ({ ...current, [key]: value }));
	}

	function handleSave() {
		onSubmit({ draft: { ...draft, name: draft.name.trim() }, refId, runAfterSave });
	}

	return (
		<>
			<DialogHeader>
				<DialogTitle>{test ? 'Edit test' : 'New test'}</DialogTitle>
				<DialogDescription>
					A test is a question with the answer you expect. nao runs it several times and reports how often the
					agent gets it right.
				</DialogDescription>
			</DialogHeader>

			<div className='grid gap-4'>
				<Field
					label='Name'
					hint={
						draft.name
							? `Saved as ${toTestFilePath(draft.name)}`
							: 'Use a / prefix to group tests, e.g. revenue/arr_current'
					}
				>
					<Input
						value={draft.name}
						onChange={(event) => update('name', event.target.value)}
						placeholder='revenue/arr_current'
						className='font-mono text-sm'
					/>
				</Field>
				<Field label='Question'>
					<Textarea
						value={draft.prompt}
						onChange={(event) => update('prompt', event.target.value)}
						placeholder='What is our current ARR?'
						className='min-h-16'
					/>
				</Field>
				<Field label='Expected SQL' hint='The result of this query is compared to the data the agent returns.'>
					<Textarea
						value={draft.sql}
						onChange={(event) => update('sql', event.target.value)}
						placeholder="SELECT SUM(arr_usd) FROM analytics.subscriptions WHERE status = 'active'"
						className='min-h-24 font-mono text-xs'
					/>
				</Field>
				<div className='grid gap-4 sm:grid-cols-2'>
					<Field label='Tags'>
						<TagInput
							tags={draft.tags}
							suggestedTags={suggestedTags}
							onChange={(tags) => update('tags', tags)}
						/>
					</Field>
					<Field label='Owner'>
						<Select value={draft.owner} onValueChange={(value) => update('owner', value)}>
							<SelectTrigger size='input'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent position='popper'>
								{OWNERS.map((owner) => (
									<SelectItem key={owner} value={owner}>
										{owner}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				</div>
			</div>

			<div className='flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-muted/40 px-4 py-3'>
				<div className='flex items-center gap-2 text-sm'>
					<GitBranch className='size-4 text-muted-foreground' />
					<span className='text-muted-foreground'>Commit to</span>
					<Select value={refId} onValueChange={setRefId}>
						<SelectTrigger className='font-mono text-[13px]'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent position='popper'>
							{branches.map((ref) => (
								<SelectItem key={ref.id} value={ref.id}>
									<span className='font-mono text-[13px]'>{ref.name}</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<label className='flex cursor-pointer items-center gap-2 text-sm'>
					<Checkbox checked={runAfterSave} onCheckedChange={(checked) => setRunAfterSave(checked === true)} />
					Run {runsPerTest}× after saving
				</label>
				{targetRef?.isProduction && (
					<p className='w-full text-xs text-amber-700 dark:text-amber-500'>
						This commits straight to production. Prefer a working branch while the test is new.
					</p>
				)}
			</div>

			<div className='flex justify-end gap-2'>
				<Button variant='outline' className='rounded-full' onClick={onCancel}>
					Cancel
				</Button>
				<Button variant='primary-gradient' className='rounded-full' disabled={!canSave} onClick={handleSave}>
					{test ? 'Save changes' : 'Add test'}
				</Button>
			</div>
		</>
	);
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
	return (
		<div className='grid gap-1.5'>
			<label className='text-sm font-medium'>{label}</label>
			{children}
			{hint && <p className='text-xs text-muted-foreground'>{hint}</p>}
		</div>
	);
}

function TagInput({
	tags,
	suggestedTags,
	onChange,
}: {
	tags: string[];
	suggestedTags: string[];
	onChange: (tags: string[]) => void;
}) {
	const [value, setValue] = useState('');

	function addTag(tag: string) {
		const normalized = tag.trim().toLowerCase();
		if (normalized && !tags.includes(normalized)) {
			onChange([...tags, normalized]);
		}
		setValue('');
	}

	function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			addTag(value);
		}
		if (event.key === 'Backspace' && value === '' && tags.length > 0) {
			onChange(tags.slice(0, -1));
		}
	}

	return (
		<div className='grid gap-1.5'>
			<div className='flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input px-2 py-1 dark:bg-input/30'>
				{tags.map((tag) => (
					<span
						key={tag}
						className='inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground/80'
					>
						{tag}
						<button
							type='button'
							onClick={() => onChange(tags.filter((t) => t !== tag))}
							className='cursor-pointer text-muted-foreground hover:text-foreground'
							aria-label={`Remove ${tag}`}
						>
							<X className='size-3' />
						</button>
					</span>
				))}
				<input
					value={value}
					onChange={(event) => setValue(event.target.value)}
					onKeyDown={handleKeyDown}
					onBlur={() => value && addTag(value)}
					placeholder={tags.length === 0 ? 'Add a tag' : ''}
					className='min-w-16 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground'
				/>
			</div>
			{suggestedTags.length > 0 && (
				<div className='flex items-center gap-1 text-xs text-muted-foreground'>
					Suggested:
					{suggestedTags.map((tag) => (
						<button
							key={tag}
							type='button'
							onClick={() => addTag(tag)}
							className='inline-flex cursor-pointer items-center gap-0.5 rounded-md border border-dashed px-1.5 py-0.5 hover:bg-muted'
						>
							<Plus className='size-3' />
							{tag}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
