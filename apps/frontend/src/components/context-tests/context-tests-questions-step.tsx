import { ChevronDown, Plus, Search, Tags, X } from 'lucide-react';

import type { ContextTest, TestTarget } from '@/components/context-tests/context-tests.mock';

import {
	allTestTags,
	changedFilesForTarget,
	findOwner,
	isTestLikelyAffected,
	testOwners,
} from '@/components/context-tests/context-tests.mock';
import { ReliabilityValue } from '@/components/context-tests/context-tests-reliability';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export const ALL_OWNERS = 'all';

export interface TestFilters {
	query: string;
	tags: string[];
	ownerId: string;
	likelyAffectedOnly: boolean;
}

export const emptyTestFilters: TestFilters = {
	query: '',
	tags: [],
	ownerId: ALL_OWNERS,
	likelyAffectedOnly: false,
};

interface ContextTestsQuestionsStepProps {
	tests: ContextTest[];
	target: TestTarget;
	selectedIds: Set<string>;
	filters: TestFilters;
	onSelectedIdsChange: (selectedIds: Set<string>) => void;
	onFiltersChange: (filters: TestFilters) => void;
	onTestTagsChange: (testId: string, tags: string[]) => void;
	onAddQuestion: () => void;
}

export function ContextTestsQuestionsStep({
	tests,
	target,
	selectedIds,
	filters,
	onSelectedIdsChange,
	onFiltersChange,
	onTestTagsChange,
	onAddQuestion,
}: ContextTestsQuestionsStepProps) {
	const changedFiles = changedFilesForTarget(target);
	const visibleTests = filterContextTests(tests, filters, changedFiles);
	const visibleSelectedCount = visibleTests.filter((test) => selectedIds.has(test.id)).length;
	const areAllVisibleSelected = visibleTests.length > 0 && visibleSelectedCount === visibleTests.length;

	const toggleTest = (testId: string, checked: boolean) => {
		const next = new Set(selectedIds);
		if (checked) {
			next.add(testId);
		} else {
			next.delete(testId);
		}
		onSelectedIdsChange(next);
	};

	const toggleAllVisible = (checked: boolean) => {
		const next = new Set(selectedIds);
		visibleTests.forEach((test) => (checked ? next.add(test.id) : next.delete(test.id)));
		onSelectedIdsChange(next);
	};

	return (
		<div className='flex flex-col gap-4'>
			<TestFiltersToolbar filters={filters} onFiltersChange={onFiltersChange} onAddQuestion={onAddQuestion} />

			<div className='flex items-center justify-between text-xs text-muted-foreground'>
				<div className='flex items-center gap-4'>
					<span>
						Showing {visibleTests.length} of {tests.length} · {selectedIds.size} selected
					</span>
					{target.kind === 'branch' && (
						<label className='flex cursor-pointer items-center gap-2'>
							<Switch
								checked={filters.likelyAffectedOnly}
								onCheckedChange={(likelyAffectedOnly) =>
									onFiltersChange({ ...filters, likelyAffectedOnly })
								}
							/>
							Only likely affected by this branch
						</label>
					)}
				</div>
				<div className='flex items-center gap-1'>
					{visibleTests.length > 0 && !areAllVisibleSelected && (
						<Button size='sm' variant='ghost-muted' onClick={() => toggleAllVisible(true)}>
							Select all {visibleTests.length} shown
						</Button>
					)}
					{selectedIds.size > 0 && (
						<Button size='sm' variant='ghost-muted' onClick={() => onSelectedIdsChange(new Set())}>
							Clear selection
						</Button>
					)}
				</div>
			</div>

			<div className='overflow-hidden rounded-xl border'>
				<div className='grid grid-cols-[auto_1fr_11rem_8.5rem_5.5rem] items-center gap-3 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
					<Checkbox
						aria-label='Select all shown questions'
						checked={areAllVisibleSelected ? true : visibleSelectedCount > 0 ? 'indeterminate' : false}
						onCheckedChange={(checked) => toggleAllVisible(checked === true)}
					/>
					<span>Question</span>
					<span>Tags</span>
					<span>Owner</span>
					<span className='text-right'>Production</span>
				</div>
				{visibleTests.length === 0 ? (
					<Empty className='py-8'>No questions match these filters.</Empty>
				) : (
					<ul className='divide-y'>
						{visibleTests.map((test) => (
							<TestQuestionRow
								key={test.id}
								test={test}
								isSelected={selectedIds.has(test.id)}
								isLikelyAffected={isTestLikelyAffected(test, changedFiles)}
								onSelectedChange={(checked) => toggleTest(test.id, checked)}
								onTagsChange={(tags) => onTestTagsChange(test.id, tags)}
							/>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

export function filterContextTests(tests: ContextTest[], filters: TestFilters, changedFiles: string[]): ContextTest[] {
	const query = filters.query.trim().toLowerCase();
	return tests.filter((test) => {
		if (query && !test.name.startsWith(query) && !test.prompt.toLowerCase().includes(query)) {
			return false;
		}
		if (filters.tags.length > 0 && !filters.tags.some((tag) => test.tags.includes(tag))) {
			return false;
		}
		if (filters.ownerId !== ALL_OWNERS && test.ownerId !== filters.ownerId) {
			return false;
		}
		if (filters.likelyAffectedOnly && !test.isDraft && !isTestLikelyAffected(test, changedFiles)) {
			return false;
		}
		return true;
	});
}

function TestFiltersToolbar({
	filters,
	onFiltersChange,
	onAddQuestion,
}: {
	filters: TestFilters;
	onFiltersChange: (filters: TestFilters) => void;
	onAddQuestion: () => void;
}) {
	const update = (patch: Partial<TestFilters>) => onFiltersChange({ ...filters, ...patch });
	const toggleTag = (tag: string, checked: boolean) =>
		update({ tags: checked ? [...filters.tags, tag] : filters.tags.filter((current) => current !== tag) });
	const hasFilters = filters.query !== '' || filters.tags.length > 0 || filters.ownerId !== ALL_OWNERS;

	return (
		<div className='flex flex-wrap items-center gap-2'>
			<div className='relative w-64'>
				<Search className='pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground' />
				<Input
					value={filters.query}
					onChange={(event) => update({ query: event.target.value })}
					placeholder='Name prefix or keyword'
					className='h-8 pl-8 text-sm'
				/>
			</div>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant='outline' size='sm' className='h-8'>
						<Tags />
						{filters.tags.length > 0 ? filters.tags.join(', ') : 'All tags'}
						<ChevronDown className='text-muted-foreground' />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align='start' className='w-48'>
					<DropdownMenuLabel>Tags</DropdownMenuLabel>
					{allTestTags.map((tag) => (
						<DropdownMenuCheckboxItem
							key={tag}
							checked={filters.tags.includes(tag)}
							onCheckedChange={(checked) => toggleTag(tag, checked)}
							onSelect={(event) => event.preventDefault()}
						>
							{tag}
						</DropdownMenuCheckboxItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>

			<Select value={filters.ownerId} onValueChange={(ownerId) => update({ ownerId })}>
				<SelectTrigger size='sm' className='h-8 w-40'>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={ALL_OWNERS}>All owners</SelectItem>
					{testOwners.map((owner) => (
						<SelectItem key={owner.id} value={owner.id}>
							{owner.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			{hasFilters && (
				<Button
					size='sm'
					variant='ghost-muted'
					className='h-8'
					onClick={() => update({ query: '', tags: [], ownerId: ALL_OWNERS })}
				>
					<X />
					Clear
				</Button>
			)}

			<Button size='sm' className='ml-auto h-8' onClick={onAddQuestion}>
				<Plus />
				Add question
			</Button>
		</div>
	);
}

function TestQuestionRow({
	test,
	isSelected,
	isLikelyAffected,
	onSelectedChange,
	onTagsChange,
}: {
	test: ContextTest;
	isSelected: boolean;
	isLikelyAffected: boolean;
	onSelectedChange: (checked: boolean) => void;
	onTagsChange: (tags: string[]) => void;
}) {
	const owner = findOwner(test.ownerId);

	return (
		<li
			className={cn(
				'grid grid-cols-[auto_1fr_11rem_8.5rem_5.5rem] items-center gap-3 px-4 py-2.5 transition-colors',
				isSelected && 'bg-primary/5',
			)}
		>
			<Checkbox
				aria-label={`Select ${test.name}`}
				checked={isSelected}
				onCheckedChange={(checked) => onSelectedChange(checked === true)}
			/>
			<div className='flex min-w-0 flex-col gap-0.5'>
				<div className='flex items-center gap-2'>
					<span className='truncate font-mono text-xs font-medium'>{test.name}</span>
					{test.isDraft && <Badge variant='context_admin'>Draft</Badge>}
					{isLikelyAffected && <Badge variant='user'>Likely affected</Badge>}
				</div>
				<span className='truncate text-sm text-muted-foreground'>{test.prompt}</span>
			</div>
			<TestTagsCell tags={test.tags} onTagsChange={onTagsChange} />
			<div className='flex min-w-0 items-center gap-2 text-xs'>
				<span className='flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold'>
					{owner.initials}
				</span>
				<span className='truncate'>{owner.name}</span>
			</div>
			<div className='text-right'>
				<ReliabilityValue rate={test.productionPassRate} />
			</div>
		</li>
	);
}

function TestTagsCell({ tags, onTagsChange }: { tags: string[]; onTagsChange: (tags: string[]) => void }) {
	const toggleTag = (tag: string, checked: boolean) =>
		onTagsChange(checked ? [...tags, tag] : tags.filter((current) => current !== tag));

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type='button'
					aria-label='Edit tags'
					className='group flex min-w-0 cursor-pointer flex-wrap items-center gap-1 rounded-md p-0.5 text-left hover:bg-accent'
				>
					{tags.length === 0 && <span className='px-1 text-xs text-muted-foreground'>Add tags</span>}
					{tags.map((tag) => (
						<Badge key={tag} variant='viewer' className='px-1.5 text-[11px]'>
							{tag}
						</Badge>
					))}
					<Plus className='size-3 text-muted-foreground opacity-0 group-hover:opacity-100' />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='start' className='w-56'>
				<DropdownMenuLabel>Tags</DropdownMenuLabel>
				{allTestTags.map((tag) => (
					<DropdownMenuCheckboxItem
						key={tag}
						checked={tags.includes(tag)}
						onCheckedChange={(checked) => toggleTag(tag, checked)}
						onSelect={(event) => event.preventDefault()}
					>
						{tag}
					</DropdownMenuCheckboxItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem disabled>Saved to the test YAML file</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
