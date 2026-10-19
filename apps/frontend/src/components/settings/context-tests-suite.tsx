import { GitBranch, ListFilter, MoreHorizontal, Pencil, Play, Plus, Search, Tag, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { ContextRef, ContextTest, TestFilter, TestOwner, TestRun } from '@/lib/context-tests';
import { ContextTestEditorDialog } from '@/components/settings/context-test-editor-dialog';
import {
	BaselineDots,
	PassRateDelta,
	PassRateLabel,
	RunProgress,
	TagChip,
} from '@/components/settings/context-test-reliability';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrentTestOwner } from '@/hooks/use-current-test-owner';
import {
	RUNS_PER_TEST_OPTIONS,
	filterTests,
	formatRelativeTime,
	formatRunCost,
	getAveragePassRate,
	getBaselinePassRate,
	getRunPassRate,
} from '@/lib/context-tests';
import { MOCK_REFS } from '@/lib/context-tests-mock';
import { cn } from '@/lib/utils';
import { contextTestsStore, getSuiteRunKeyPrefix, useContextTests } from '@/stores/context-tests';

const EMPTY_FILTER: TestFilter = { namePrefix: '', tags: [], ownerIds: [] };

export function ContextTestsSuite() {
	const { tests, owners, suiteRuns } = useContextTests();
	const currentOwner = useCurrentTestOwner();
	const [refId, setRefId] = useState(MOCK_REFS[0].id);
	const [filter, setFilter] = useState<TestFilter>(EMPTY_FILTER);
	const [runsPerTest, setRunsPerTest] = useState<number>(3);
	const [editingTest, setEditingTest] = useState<ContextTest | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [deletingTest, setDeletingTest] = useState<ContextTest | null>(null);
	const selectedRef = MOCK_REFS.find((ref) => ref.id === refId) ?? MOCK_REFS[0];
	const filteredTests = useMemo(() => filterTests(tests, filter), [tests, filter]);
	const runs = useMemo(() => getRunsForRef(suiteRuns, selectedRef.id), [suiteRuns, selectedRef.id]);
	const isRunning = filteredTests.some((test) => isPending(runs[test.id]));
	const hasFilter = filter.namePrefix !== '' || filter.tags.length > 0 || filter.ownerIds.length > 0;

	const runTests = (testIds: string[], runCount = runsPerTest) => {
		contextTestsStore.runSuite({
			testIds,
			runsPerTest: runCount,
			refId: selectedRef.id,
			isProduction: selectedRef.isProduction === true,
		});
	};

	const toggleTag = (tag: string) => {
		setFilter({ ...filter, tags: toggleValue(filter.tags, tag) });
	};

	return (
		<div className='flex flex-col gap-5'>
			<div className='flex items-start gap-4'>
				<div className='min-w-0 flex-1'>
					<h1 className='text-xl font-semibold text-foreground'>Tests</h1>
					<p className='mt-1 text-sm text-muted-foreground'>
						Questions with a known right answer. Run them against production or any working branch, with no
						local setup. To test a context change before saving it, open the file in the File Explorer.
					</p>
				</div>
				<Button size='sm' onClick={() => setIsCreating(true)}>
					<Plus />
					New test
				</Button>
			</div>

			<RefBar
				selectedRef={selectedRef}
				owners={owners}
				onRefChange={setRefId}
				tests={filteredTests}
				runs={runs}
			/>

			<div className='flex flex-wrap items-center gap-2'>
				<div className='relative w-64'>
					<Search className='pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground' />
					<input
						type='text'
						aria-label='Filter by name prefix'
						placeholder='Name starts with…'
						value={filter.namePrefix}
						onChange={(event) => setFilter({ ...filter, namePrefix: event.target.value })}
						className='h-8 w-full rounded-md border border-input bg-transparent pl-8 pr-2 font-mono text-xs placeholder:font-sans placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
					/>
				</div>
				<TagFilter tests={tests} selectedTags={filter.tags} onToggle={toggleTag} />
				<OwnerFilter
					owners={owners}
					tests={tests}
					selectedOwnerIds={filter.ownerIds}
					onToggle={(ownerId) => setFilter({ ...filter, ownerIds: toggleValue(filter.ownerIds, ownerId) })}
				/>
				{hasFilter && (
					<Button
						variant='ghost-muted'
						size='sm'
						className='h-8 text-xs'
						onClick={() => setFilter(EMPTY_FILTER)}
					>
						<X />
						Clear
					</Button>
				)}
				<div className='ml-auto flex items-center gap-2'>
					<span className='text-xs text-muted-foreground tabular-nums'>
						{filteredTests.length} of {tests.length} tests
					</span>
					<Select value={String(runsPerTest)} onValueChange={(value) => setRunsPerTest(Number(value))}>
						<SelectTrigger size='sm' className='h-8 w-[110px] text-xs' aria-label='Runs per test'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{RUNS_PER_TEST_OPTIONS.map((option) => (
								<SelectItem key={option} value={String(option)}>
									{option === 1 ? '1 run each' : `${option} runs each`}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						size='sm'
						className='h-8'
						disabled={filteredTests.length === 0 || isRunning}
						onClick={() => runTests(filteredTests.map((test) => test.id))}
					>
						<Play />
						{isRunning
							? 'Running…'
							: `Run ${hasFilter ? 'filtered' : 'all'} (${filteredTests.length}) · ${formatRunCost(filteredTests.length, runsPerTest)}`}
					</Button>
				</div>
			</div>

			<div className='overflow-hidden rounded-xl border border-border'>
				<Table>
					<TableHeader>
						<TableRow className='bg-muted/30 hover:bg-muted/30'>
							<TableHead className='w-[34%] pl-4'>Test</TableHead>
							<TableHead className='w-[16%]'>Tags</TableHead>
							<TableHead>Owner</TableHead>
							<TableHead>Reliability on {selectedRef.label}</TableHead>
							<TableHead>Last run</TableHead>
							<TableHead className='w-20' />
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredTests.length === 0 ? (
							<TableRow>
								<TableCell colSpan={6} className='py-10 text-center text-sm text-muted-foreground'>
									No tests match these filters.
								</TableCell>
							</TableRow>
						) : (
							filteredTests.map((test) => (
								<TestTableRow
									key={test.id}
									test={test}
									owner={owners.find((owner) => owner.id === test.ownerId) ?? currentOwner}
									selectedRef={selectedRef}
									run={runs[test.id]}
									activeTags={filter.tags}
									onTagClick={toggleTag}
									onRun={(runCount) => runTests([test.id], runCount)}
									onEdit={() => setEditingTest(test)}
									onDelete={() => setDeletingTest(test)}
								/>
							))
						)}
					</TableBody>
				</Table>
			</div>

			<ContextTestEditorDialog
				open={isCreating || editingTest !== null}
				onOpenChange={(open) => {
					if (!open) {
						setIsCreating(false);
						setEditingTest(null);
					}
				}}
				test={editingTest ?? undefined}
				branch={selectedRef.kind === 'branch' ? selectedRef.label : 'main'}
				currentOwner={currentOwner}
			/>
			<ConfirmationDialog
				open={deletingTest !== null}
				onOpenChange={(open) => !open && setDeletingTest(null)}
				title='Delete this test?'
				description={`tests/${deletingTest?.name}.yml will be removed from ${selectedRef.kind === 'branch' ? selectedRef.label : 'main'}.`}
				confirmLabel='Delete test'
				onConfirm={() => {
					if (deletingTest) {
						contextTestsStore.deleteTest(deletingTest.id);
					}
					setDeletingTest(null);
				}}
			/>
		</div>
	);
}

function RefBar({
	selectedRef,
	owners,
	onRefChange,
	tests,
	runs,
}: {
	selectedRef: ContextRef;
	owners: TestOwner[];
	onRefChange: (refId: string) => void;
	tests: ContextTest[];
	runs: Record<string, TestRun>;
}) {
	const reliability = getAveragePassRate(tests.map((test) => getTestPassRate(test, selectedRef, runs[test.id])));
	const productionReliability = getAveragePassRate(
		tests.filter((test) => runs[test.id]?.status === 'done').map(getBaselinePassRate),
	);
	const lastRunAt = getLatestRunDate(tests, selectedRef, runs);
	const refOwner = owners.find((owner) => owner.id === selectedRef.ownerId);

	return (
		<div className='flex items-center gap-6 rounded-xl border border-border bg-card px-4 py-3'>
			<div className='flex items-center gap-3'>
				<span className='text-sm text-muted-foreground'>Run against</span>
				<Select value={selectedRef.id} onValueChange={onRefChange}>
					<SelectTrigger className='h-8 w-[280px] font-mono text-xs' aria-label='Branch or tag'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{MOCK_REFS.map((ref) => (
							<SelectItem key={ref.id} value={ref.id} className='font-mono text-xs'>
								{ref.kind === 'tag' ? <Tag className='size-3.5' /> : <GitBranch className='size-3.5' />}
								{ref.label}
								{ref.isProduction && (
									<span className='font-sans text-muted-foreground'>production</span>
								)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<span className='font-mono text-xs text-muted-foreground'>{selectedRef.commit}</span>
				{refOwner && <span className='text-xs text-muted-foreground'>pushed by {refOwner.name}</span>}
			</div>
			<div className='ml-auto flex items-center gap-6'>
				<Stat label={selectedRef.isProduction ? 'Reliability' : 'Reliability vs main'}>
					<span className='flex items-center gap-2'>
						{!selectedRef.isProduction && (
							<PassRateDelta before={productionReliability} after={reliability} />
						)}
						<PassRateLabel rate={reliability} className='text-base font-semibold' />
					</span>
				</Stat>
				<Stat label='Tests'>
					<span className='text-base font-semibold tabular-nums'>{tests.length}</span>
				</Stat>
				<Stat label='Last run'>
					<span className='text-sm'>{formatRelativeTime(lastRunAt)}</span>
				</Stat>
			</div>
		</div>
	);
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className='flex flex-col items-end leading-tight'>
			<span className='text-[11px] text-muted-foreground'>{label}</span>
			{children}
		</div>
	);
}

function TestTableRow({
	test,
	owner,
	selectedRef,
	run,
	activeTags,
	onTagClick,
	onRun,
	onEdit,
	onDelete,
}: {
	test: ContextTest;
	owner: TestOwner;
	selectedRef: ContextRef;
	run: TestRun | undefined;
	activeTags: string[];
	onTagClick: (tag: string) => void;
	onRun: (runCount?: number) => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const passRate = getTestPassRate(test, selectedRef, run);
	const lastRunAt = run?.ranAt ?? (selectedRef.isProduction ? (test.baseline?.ranAt ?? null) : null);

	return (
		<TableRow className='group'>
			<TableCell className='max-w-0 pl-4'>
				<button type='button' onClick={onEdit} className='block w-full text-left'>
					<span className='block truncate font-mono text-xs text-foreground'>{test.name}</span>
					<span className='block truncate text-xs text-muted-foreground'>{test.prompt}</span>
				</button>
			</TableCell>
			<TableCell>
				<div className='flex flex-wrap gap-1'>
					{test.tags.map((tag) => (
						<TagChip key={tag} tag={tag} isActive={activeTags.includes(tag)} onClick={onTagClick} />
					))}
				</div>
			</TableCell>
			<TableCell>
				<div className='text-xs text-foreground'>{owner.name}</div>
				{test.branch !== 'main' && (
					<div className='flex items-center gap-1 font-mono text-[11px] text-muted-foreground'>
						<GitBranch className='size-3' />
						{test.branch}
					</div>
				)}
			</TableCell>
			<TableCell>
				<ReliabilityCell test={test} selectedRef={selectedRef} run={run} passRate={passRate} />
			</TableCell>
			<TableCell className='text-xs text-muted-foreground'>{formatRelativeTime(lastRunAt)}</TableCell>
			<TableCell>
				<div className='flex items-center justify-end gap-0.5 pr-1'>
					<Button
						variant='ghost-muted'
						size='icon-sm'
						aria-label={`Run ${test.name}`}
						disabled={isPending(run)}
						onClick={() => onRun()}
					>
						<Play />
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant='ghost-muted' size='icon-sm' aria-label={`More actions for ${test.name}`}>
								<MoreHorizontal />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end'>
							<DropdownMenuItem onSelect={onEdit}>
								<Pencil />
								Edit test
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => onRun(5)}>
								<Play />
								Run 5 times
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem variant='destructive' onSelect={onDelete}>
								<Trash2 />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</TableCell>
		</TableRow>
	);
}

function ReliabilityCell({
	test,
	selectedRef,
	run,
	passRate,
}: {
	test: ContextTest;
	selectedRef: ContextRef;
	run: TestRun | undefined;
	passRate: number | null;
}) {
	if (run) {
		return (
			<div className='flex items-center gap-2'>
				<RunProgress run={run} />
				{run.status === 'done' && <PassRateLabel rate={passRate} />}
				{run.status === 'done' && !selectedRef.isProduction && (
					<PassRateDelta before={getBaselinePassRate(test)} after={passRate} />
				)}
			</div>
		);
	}
	if (selectedRef.isProduction && test.baseline) {
		return (
			<div className='flex items-center gap-2'>
				<BaselineDots passes={test.baseline.passes} runs={test.baseline.runs} />
				<PassRateLabel rate={passRate} />
			</div>
		);
	}
	return <span className='text-xs text-muted-foreground'>Not run yet</span>;
}

function TagFilter({
	tests,
	selectedTags,
	onToggle,
}: {
	tests: ContextTest[];
	selectedTags: string[];
	onToggle: (tag: string) => void;
}) {
	const tagCounts = useMemo(() => countTags(tests), [tests]);
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<FilterButton icon={<Tag />} label='Tags' count={selectedTags.length} />
			</DropdownMenuTrigger>
			<DropdownMenuContent align='start' className='w-56'>
				<DropdownMenuLabel className='text-xs text-muted-foreground'>Show tests with all of</DropdownMenuLabel>
				{tagCounts.map(([tag, count]) => (
					<DropdownMenuCheckboxItem
						key={tag}
						checked={selectedTags.includes(tag)}
						onCheckedChange={() => onToggle(tag)}
						onSelect={(event) => event.preventDefault()}
					>
						<span className='flex-1'>{tag}</span>
						<span className='text-xs text-muted-foreground tabular-nums'>{count}</span>
					</DropdownMenuCheckboxItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function OwnerFilter({
	owners,
	tests,
	selectedOwnerIds,
	onToggle,
}: {
	owners: TestOwner[];
	tests: ContextTest[];
	selectedOwnerIds: string[];
	onToggle: (ownerId: string) => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<FilterButton icon={<ListFilter />} label='Owner' count={selectedOwnerIds.length} />
			</DropdownMenuTrigger>
			<DropdownMenuContent align='start' className='w-72'>
				<DropdownMenuLabel className='text-xs text-muted-foreground'>Owned or pushed by</DropdownMenuLabel>
				{owners.map((owner) => {
					const ownedBranch = MOCK_REFS.find((ref) => ref.ownerId === owner.id);
					return (
						<DropdownMenuCheckboxItem
							key={owner.id}
							checked={selectedOwnerIds.includes(owner.id)}
							onCheckedChange={() => onToggle(owner.id)}
							onSelect={(event) => event.preventDefault()}
						>
							<div className='min-w-0 flex-1'>
								<div>{owner.name}</div>
								{ownedBranch && (
									<div className='truncate font-mono text-[11px] text-muted-foreground'>
										{ownedBranch.label}
									</div>
								)}
							</div>
							<span className='text-xs text-muted-foreground tabular-nums'>
								{tests.filter((test) => test.ownerId === owner.id).length}
							</span>
						</DropdownMenuCheckboxItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function FilterButton({
	icon,
	label,
	count,
	...props
}: React.ComponentProps<typeof Button> & { icon: React.ReactNode; label: string; count: number }) {
	return (
		<Button
			variant='outline'
			size='sm'
			className={cn('h-8 text-xs', count > 0 && 'border-primary/40 text-primary')}
			{...props}
		>
			{icon}
			{label}
			{count > 0 && <span className='rounded bg-primary/10 px-1 tabular-nums'>{count}</span>}
		</Button>
	);
}

function getRunsForRef(suiteRuns: Record<string, TestRun>, refId: string): Record<string, TestRun> {
	const prefix = getSuiteRunKeyPrefix(refId);
	return Object.fromEntries(
		Object.entries(suiteRuns)
			.filter(([key]) => key.startsWith(prefix))
			.map(([key, run]) => [key.slice(prefix.length), run]),
	);
}

function getTestPassRate(test: ContextTest, selectedRef: ContextRef, run: TestRun | undefined): number | null {
	if (run) {
		return getRunPassRate(run);
	}
	return selectedRef.isProduction ? getBaselinePassRate(test) : null;
}

function getLatestRunDate(tests: ContextTest[], selectedRef: ContextRef, runs: Record<string, TestRun>): string | null {
	const dates = tests
		.map((test) => runs[test.id]?.ranAt ?? (selectedRef.isProduction ? test.baseline?.ranAt : null))
		.filter((date): date is string => Boolean(date));
	return dates.sort().at(-1) ?? null;
}

function countTags(tests: ContextTest[]): [string, number][] {
	const counts = new Map<string, number>();
	tests.forEach((test) => test.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
	return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

function toggleValue(values: string[], value: string): string[] {
	return values.includes(value) ? values.filter((existing) => existing !== value) : [...values, value];
}

function isPending(run: TestRun | undefined): boolean {
	return run?.status === 'queued' || run?.status === 'running';
}
