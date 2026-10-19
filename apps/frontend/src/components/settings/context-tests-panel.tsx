import { Link } from '@tanstack/react-router';
import { ArrowRight, FlaskConical, Info, Play, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { TestEditorDefaults } from '@/components/settings/context-test-editor-dialog';
import type { ContextTest, TestRelevance, TestRelevanceLevel, TestRun } from '@/lib/context-tests';
import { ContextTestEditorDialog } from '@/components/settings/context-test-editor-dialog';
import {
	BaselineDots,
	PassRateDelta,
	PassRateLabel,
	RunProgress,
	TagChip,
} from '@/components/settings/context-test-reliability';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { useCurrentTestOwner } from '@/hooks/use-current-test-owner';
import {
	RUNS_PER_TEST_OPTIONS,
	findRelevantTests,
	formatRunCost,
	getAveragePassRate,
	getBaselinePassRate,
	getContextFileLabel,
	getRunPassRate,
	getTableFromContextPath,
} from '@/lib/context-tests';
import { MOCK_REFS } from '@/lib/context-tests-mock';
import { cn } from '@/lib/utils';
import { contextTestsStore, useContextTests } from '@/stores/context-tests';

interface ContextTestsPanelProps {
	filePath: string;
	hasUnsavedEdits: boolean;
	onClose: () => void;
}

const PRODUCTION_REF = MOCK_REFS.find((ref) => ref.isProduction) ?? MOCK_REFS[0];
const DEFAULT_LIKELY_SELECTION = 3;

const RELEVANCE_SECTIONS: { level: TestRelevanceLevel; title: string; description: string }[] = [
	{
		level: 'direct',
		title: 'Directly affected',
		description: 'The expected SQL of these tests reads the table this file documents.',
	},
	{
		level: 'likely',
		title: 'Possibly affected',
		description:
			'Picked by the agent from joins and question wording. Prose edits can ripple further than SQL references show.',
	},
];

export function ContextTestsPanel({ filePath, hasUnsavedEdits, onClose }: ContextTestsPanelProps) {
	const { tests, draftRuns, draftFilePath } = useContextTests();
	const currentOwner = useCurrentTestOwner();
	const relevantTests = useMemo(() => findRelevantTests(tests, filePath), [tests, filePath]);
	const [pinnedTests, setPinnedTests] = useState<TestRelevance[]>([]);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => getDefaultSelection(relevantTests));
	const [runsPerTest, setRunsPerTest] = useState<number>(3);
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const runs = draftFilePath === filePath ? draftRuns : {};
	const listedTests = [...relevantTests, ...pinnedTests];
	const selectedTests = listedTests.filter(({ test }) => selectedIds.has(test.id));
	const isRunning = selectedTests.some(({ test }) => isPending(runs[test.id]));
	const unlistedTests = tests.filter((test) => !listedTests.some((listed) => listed.test.id === test.id));
	const table = getTableFromContextPath(filePath);

	const toggleTest = (testId: string) => {
		const next = new Set(selectedIds);
		if (next.has(testId)) {
			next.delete(testId);
		} else {
			next.add(testId);
		}
		setSelectedIds(next);
	};

	const pinTest = (test: ContextTest) => {
		setPinnedTests([...pinnedTests, { test, level: 'likely', reason: 'Added by you' }]);
		setSelectedIds(new Set([...selectedIds, test.id]));
	};

	const handleRun = () => {
		contextTestsStore.runAgainstDraft({
			filePath,
			testIds: selectedTests.map(({ test }) => test.id),
			runsPerTest,
			hasUnsavedEdits,
		});
	};

	const editorDefaults: TestEditorDefaults = table
		? { tags: [table], tables: [table], sql: `SELECT …\nFROM ${table}` }
		: {};

	return (
		<aside aria-label='Tests for this file' className='flex h-full w-[360px] shrink-0 flex-col border-l bg-card'>
			<div className='flex shrink-0 items-center gap-2 border-b border-border bg-muted/30 px-3 py-2.5'>
				<FlaskConical className='size-4 text-muted-foreground' />
				<div className='min-w-0 flex-1'>
					<div className='text-sm font-medium leading-4'>Tests for this file</div>
					<div className='truncate font-mono text-xs leading-4 text-muted-foreground'>
						{getContextFileLabel(filePath)}
					</div>
				</div>
				<Button variant='ghost-muted' size='icon-xs' aria-label='Close tests' onClick={onClose}>
					<X />
				</Button>
			</div>

			<CompareStrip hasUnsavedEdits={hasUnsavedEdits} />

			<div className='min-h-0 flex-1 overflow-y-auto'>
				<ReliabilitySummary selectedTests={selectedTests.map(({ test }) => test)} runs={runs} />

				{listedTests.length === 0 ? (
					<div className='flex flex-col items-center gap-3 px-6 py-10 text-center text-sm text-muted-foreground'>
						<p>No tests reference this file yet.</p>
						<Button size='sm' variant='outline' onClick={() => setIsEditorOpen(true)}>
							<Plus />
							Write the first one
						</Button>
					</div>
				) : (
					RELEVANCE_SECTIONS.map((section) => {
						const sectionTests = listedTests.filter(({ level }) => level === section.level);
						if (sectionTests.length === 0) {
							return null;
						}
						return (
							<section key={section.level} className='border-b border-border py-2'>
								<div className='flex items-center gap-1.5 px-3 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
									{section.title}
									<span className='text-muted-foreground/60'>{sectionTests.length}</span>
									<SimpleTooltip content={section.description}>
										<Info className='size-3 text-muted-foreground/70' />
									</SimpleTooltip>
								</div>
								{sectionTests.map((relevance) => (
									<TestRow
										key={relevance.test.id}
										relevance={relevance}
										run={runs[relevance.test.id]}
										isSelected={selectedIds.has(relevance.test.id)}
										onToggle={() => toggleTest(relevance.test.id)}
									/>
								))}
							</section>
						);
					})
				)}

				{unlistedTests.length > 0 && (
					<div className='px-3 py-2'>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant='ghost-muted' size='sm' className='h-7 px-2 text-xs'>
									<Plus />
									Add another test to this run
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align='start' className='max-h-72 w-72 overflow-y-auto'>
								<DropdownMenuLabel className='text-xs text-muted-foreground'>
									All tests
								</DropdownMenuLabel>
								{unlistedTests.map((test) => (
									<DropdownMenuItem key={test.id} onSelect={() => pinTest(test)}>
										<div className='min-w-0'>
											<div className='truncate font-mono text-xs'>{test.name}</div>
											<div className='truncate text-xs text-muted-foreground'>{test.prompt}</div>
										</div>
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				)}
			</div>

			<div className='shrink-0 space-y-2.5 border-t border-border bg-muted/20 p-3'>
				<div className='flex items-center gap-2 text-xs text-muted-foreground'>
					<span>Runs per test</span>
					<RunsPerTestToggle value={runsPerTest} onChange={setRunsPerTest} />
					<SimpleTooltip content='Answers vary between runs. Running each question several times gives a reliability rate instead of a single pass or fail.'>
						<span className='ml-auto tabular-nums'>
							{selectedTests.length * runsPerTest} runs ·{' '}
							{formatRunCost(selectedTests.length, runsPerTest)}
						</span>
					</SimpleTooltip>
				</div>
				<Button
					className='w-full'
					size='sm'
					onClick={handleRun}
					disabled={selectedTests.length === 0 || isRunning}
				>
					<Play />
					{getRunLabel(selectedTests.length, hasUnsavedEdits, isRunning)}
				</Button>
				<div className='flex items-center justify-between'>
					<Button
						variant='ghost-muted'
						size='sm'
						className='h-7 px-2 text-xs'
						onClick={() => setIsEditorOpen(true)}
					>
						<Plus />
						New test from this file
					</Button>
					<Button variant='ghost-muted' size='sm' className='h-7 px-2 text-xs' asChild>
						<Link to='/settings/tests'>
							All tests
							<ArrowRight />
						</Link>
					</Button>
				</div>
			</div>

			<ContextTestEditorDialog
				open={isEditorOpen}
				onOpenChange={setIsEditorOpen}
				defaults={editorDefaults}
				branch={PRODUCTION_REF.label}
				currentOwner={currentOwner}
				onSaved={(test) => pinTest(test)}
			/>
		</aside>
	);
}

export function ContextTestsToggle({
	filePath,
	isOpen,
	onToggle,
}: {
	filePath: string;
	isOpen: boolean;
	onToggle: () => void;
}) {
	const { tests } = useContextTests();
	const affectedCount = useMemo(() => findRelevantTests(tests, filePath).length, [tests, filePath]);
	return (
		<SimpleTooltip content={isOpen ? 'Hide tests' : 'Show tests affected by this file'}>
			<Button
				type='button'
				variant='outline'
				size='sm'
				className={cn('h-7 gap-1.5', isOpen && 'bg-accent text-accent-foreground dark:bg-accent/50')}
				onClick={onToggle}
				aria-pressed={isOpen}
			>
				<FlaskConical className='size-3.5' />
				Tests
				<span className='text-xs tabular-nums text-muted-foreground'>{affectedCount}</span>
			</Button>
		</SimpleTooltip>
	);
}

function CompareStrip({ hasUnsavedEdits }: { hasUnsavedEdits: boolean }) {
	return (
		<div className='flex shrink-0 items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground'>
			<span>Compare</span>
			<TagChip tag={`${PRODUCTION_REF.label} · production`} />
			<ArrowRight className='size-3' />
			{hasUnsavedEdits ? (
				<span className='inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400'>
					<span className='size-1.5 rounded-full bg-current' />
					Your unsaved draft
				</span>
			) : (
				<span>Saved file</span>
			)}
		</div>
	);
}

function ReliabilitySummary({ selectedTests, runs }: { selectedTests: ContextTest[]; runs: Record<string, TestRun> }) {
	const baselineRate = getAveragePassRate(selectedTests.map(getBaselinePassRate));
	const completedTests = selectedTests.filter((test) => runs[test.id]?.status === 'done');
	const draftRate = getAveragePassRate(completedTests.map((test) => getRunPassRate(runs[test.id])));
	const comparedBaselineRate = getAveragePassRate(completedTests.map(getBaselinePassRate));
	const changes = countChanges(completedTests, runs);
	const hasResults = completedTests.length > 0;

	return (
		<div className='border-b border-border px-3 py-3'>
			<div className='flex items-end gap-3'>
				<ReliabilityFigure label='Production' rate={hasResults ? comparedBaselineRate : baselineRate} />
				<ArrowRight className='mb-1.5 size-4 text-muted-foreground/60' />
				<ReliabilityFigure label='With your change' rate={hasResults ? draftRate : null} />
				<div className='mb-1 ml-auto'>
					<PassRateDelta before={comparedBaselineRate} after={hasResults ? draftRate : null} />
				</div>
			</div>
			<p className='mt-2 text-xs text-muted-foreground'>
				{hasResults
					? `${changes.regressed.length} regressed · ${changes.improved} improved · ${changes.unchanged} unchanged`
					: `Average pass rate of the ${selectedTests.length} selected tests. Run them to see the impact of your change.`}
			</p>
			{changes.regressed.length > 0 && (
				<div className='mt-2.5 rounded-md border border-red-500/20 bg-red-500/5 px-2.5 py-2 text-xs text-red-700 dark:text-red-300'>
					Your change makes{' '}
					{changes.regressed.map((name, index) => (
						<span key={name}>
							{index > 0 && ', '}
							<span className='font-mono'>{name}</span>
						</span>
					))}{' '}
					less reliable. Review the answers before saving.
				</div>
			)}
		</div>
	);
}

function ReliabilityFigure({ label, rate }: { label: string; rate: number | null }) {
	return (
		<div className='flex flex-col'>
			<span className='text-[11px] text-muted-foreground'>{label}</span>
			<PassRateLabel rate={rate} className='text-xl font-semibold' />
		</div>
	);
}

function TestRow({
	relevance,
	run,
	isSelected,
	onToggle,
}: {
	relevance: TestRelevance;
	run: TestRun | undefined;
	isSelected: boolean;
	onToggle: () => void;
}) {
	const { test, reason } = relevance;
	const checkboxId = `context-test-${test.id}`;
	return (
		<div
			className={cn(
				'group flex items-start gap-2.5 px-3 py-1.5 transition-colors hover:bg-muted/40',
				!isSelected && 'opacity-60',
			)}
		>
			<Checkbox id={checkboxId} checked={isSelected} onCheckedChange={onToggle} className='mt-0.5' />
			<label htmlFor={checkboxId} className='min-w-0 flex-1 cursor-pointer'>
				<SimpleTooltip content={test.prompt} side='left'>
					<span className='block truncate font-mono text-xs leading-5'>{test.name}</span>
				</SimpleTooltip>
				<span className='block truncate text-[11px] leading-4 text-muted-foreground'>{reason}</span>
			</label>
			<div className='flex shrink-0 flex-col items-end gap-1 pt-1'>
				<div className='flex items-center gap-1.5'>
					{test.baseline ? (
						<BaselineDots passes={test.baseline.passes} runs={test.baseline.runs} />
					) : (
						<span className='text-[11px] text-muted-foreground'>new</span>
					)}
					{run && (
						<>
							<ArrowRight className='size-3 text-muted-foreground/60' />
							<RunProgress run={run} />
						</>
					)}
				</div>
				{run?.status === 'done' && (
					<PassRateDelta before={getBaselinePassRate(test)} after={getRunPassRate(run)} />
				)}
			</div>
		</div>
	);
}

function RunsPerTestToggle({ value, onChange }: { value: number; onChange: (value: number) => void }) {
	return (
		<div role='radiogroup' aria-label='Runs per test' className='inline-flex rounded-md border border-border p-0.5'>
			{RUNS_PER_TEST_OPTIONS.map((option) => (
				<button
					key={option}
					type='button'
					role='radio'
					aria-checked={value === option}
					onClick={() => onChange(option)}
					className={cn(
						'h-5 min-w-6 rounded-sm px-1.5 text-[11px] tabular-nums transition-colors',
						value === option ? 'bg-foreground text-background' : 'hover:text-foreground',
					)}
				>
					×{option}
				</button>
			))}
		</div>
	);
}

function getDefaultSelection(relevantTests: TestRelevance[]): Set<string> {
	const directIds = relevantTests.filter(({ level }) => level === 'direct').map(({ test }) => test.id);
	if (directIds.length > 0) {
		return new Set(directIds);
	}
	return new Set(relevantTests.slice(0, DEFAULT_LIKELY_SELECTION).map(({ test }) => test.id));
}

function countChanges(tests: ContextTest[], runs: Record<string, TestRun>) {
	return tests.reduce(
		(counts, test) => {
			const before = getBaselinePassRate(test);
			const after = getRunPassRate(runs[test.id]);
			if (before === null || after === null || Math.abs(after - before) < 0.01) {
				return { ...counts, unchanged: counts.unchanged + 1 };
			}
			return after > before
				? { ...counts, improved: counts.improved + 1 }
				: { ...counts, regressed: [...counts.regressed, test.name] };
		},
		{ regressed: [] as string[], improved: 0, unchanged: 0 },
	);
}

function isPending(run: TestRun | undefined): boolean {
	return run?.status === 'queued' || run?.status === 'running';
}

function getRunLabel(testCount: number, hasUnsavedEdits: boolean, isRunning: boolean): string {
	if (isRunning) {
		return 'Running…';
	}
	const target = hasUnsavedEdits ? 'your draft' : 'the saved file';
	return `Run ${testCount} ${testCount === 1 ? 'test' : 'tests'} against ${target}`;
}
