import {
	ChevronRight,
	ExternalLink,
	FilePlus2,
	GitCommitHorizontal,
	ListChecks,
	RotateCcw,
	Square,
} from 'lucide-react';
import { useState } from 'react';

import type { ContextTest, TestTarget } from '@/components/context-tests/context-tests.mock';
import type { TestRunOutcome } from '@/hooks/use-context-test-run';

import { describeTarget } from '@/components/context-tests/context-tests.mock';
import {
	ReliabilityValue,
	formatPercent,
	reliabilityTextClass,
} from '@/components/context-tests/context-tests-reliability';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TestVerdict = 'running' | 'regressed' | 'new' | 'improved' | 'stable';

interface TestResultSummary {
	test: ContextTest;
	outcomes: TestRunOutcome[];
	passedCount: number;
	finishedCount: number;
	rate: number | null;
	baseline: number | null;
	verdict: TestVerdict;
}

const verdictOrder: TestVerdict[] = ['regressed', 'new', 'improved', 'stable', 'running'];

const REGRESSION_THRESHOLD = 0.2;

interface ContextTestsReviewStepProps {
	tests: ContextTest[];
	target: TestTarget;
	outcomes: TestRunOutcome[];
	isRunning: boolean;
	completedCount: number;
	totalCount: number;
	savedDraftNames: string[];
	onCancel: () => void;
	onRerun: (testIds: string[]) => void;
	onEditQuestions: () => void;
	onSaveDrafts: (testIds: string[]) => void;
}

export function ContextTestsReviewStep({
	tests,
	target,
	outcomes,
	isRunning,
	completedCount,
	totalCount,
	savedDraftNames,
	onCancel,
	onRerun,
	onEditQuestions,
	onSaveDrafts,
}: ContextTestsReviewStepProps) {
	const summaries = summarizeResults(tests, outcomes);
	const orderedSummaries = isRunning ? summaries : sortByVerdict(summaries);
	const regressedIds = summaries
		.filter((summary) => summary.verdict === 'regressed')
		.map((summary) => summary.test.id);
	const draftTests = tests.filter((test) => test.isDraft);

	return (
		<div className='flex flex-col gap-5'>
			{isRunning ? (
				<RunProgress
					target={target}
					completedCount={completedCount}
					totalCount={totalCount}
					onCancel={onCancel}
				/>
			) : (
				<div className='flex flex-wrap items-center justify-between gap-3'>
					<div className='text-sm'>
						Finished {totalCount} runs on <TargetLabel target={target} />
					</div>
					<div className='flex items-center gap-2'>
						<Button size='sm' variant='ghost-muted' onClick={onEditQuestions}>
							<ListChecks />
							Change questions
						</Button>
						<Button size='sm' variant='outline' onClick={() => onRerun(tests.map((test) => test.id))}>
							<RotateCcw />
							Run again
						</Button>
						{regressedIds.length > 0 && (
							<Button size='sm' onClick={() => onRerun(regressedIds)}>
								<RotateCcw />
								Re-run {regressedIds.length} regressed
							</Button>
						)}
					</div>
				</div>
			)}

			<ResultsOverview summaries={summaries} isRunning={isRunning} target={target} />

			{!isRunning && draftTests.length > 0 && (
				<DraftsCallout
					draftTests={draftTests}
					summaries={summaries}
					target={target}
					onSave={() => onSaveDrafts(draftTests.map((test) => test.id))}
				/>
			)}
			{!isRunning && draftTests.length === 0 && savedDraftNames.length > 0 && (
				<SavedDraftsNotice names={savedDraftNames} target={target} />
			)}

			<div className='overflow-hidden rounded-xl border'>
				<div className='grid grid-cols-[1rem_1fr_6rem_4.5rem_5.5rem_10rem] items-center gap-3 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
					<span />
					<span>Question</span>
					<span>Runs</span>
					<span className='text-right'>This run</span>
					<span className='text-right'>Production</span>
					<span className='text-right'>Change</span>
				</div>
				<ul className='divide-y'>
					{orderedSummaries.map((summary) => (
						<TestResultRow
							key={`${summary.test.id}-${isRunning ? 'live' : 'done'}`}
							summary={summary}
							defaultOpen={summary.test.id === regressedIds[0]}
						/>
					))}
				</ul>
			</div>
		</div>
	);
}

function summarizeResults(tests: ContextTest[], outcomes: TestRunOutcome[]): TestResultSummary[] {
	return tests.map((test) => {
		const testOutcomes = outcomes.filter((outcome) => outcome.testId === test.id);
		const passedCount = testOutcomes.filter((outcome) => outcome.status === 'passed').length;
		const finishedCount = testOutcomes.filter(
			(outcome) => outcome.status === 'passed' || outcome.status === 'failed',
		).length;
		const rate = finishedCount > 0 ? passedCount / finishedCount : null;
		const isFinished = testOutcomes.length > 0 && finishedCount === testOutcomes.length;
		return {
			test,
			outcomes: testOutcomes,
			passedCount,
			finishedCount,
			rate,
			baseline: test.productionPassRate,
			verdict: isFinished ? verdictFor(rate ?? 0, test.productionPassRate) : 'running',
		};
	});
}

function verdictFor(rate: number, baseline: number | null): TestVerdict {
	if (baseline === null) {
		return 'new';
	}
	if (rate - baseline <= -REGRESSION_THRESHOLD) {
		return 'regressed';
	}
	if (rate - baseline >= REGRESSION_THRESHOLD) {
		return 'improved';
	}
	return 'stable';
}

function sortByVerdict(summaries: TestResultSummary[]): TestResultSummary[] {
	return [...summaries].sort((a, b) => verdictOrder.indexOf(a.verdict) - verdictOrder.indexOf(b.verdict));
}

function TargetLabel({ target }: { target: TestTarget }) {
	if (target.kind === 'production') {
		return <span className='font-medium'>production</span>;
	}
	return <span className='rounded bg-muted px-1.5 py-0.5 font-mono text-xs'>{target.ref}</span>;
}

function RunProgress({
	target,
	completedCount,
	totalCount,
	onCancel,
}: {
	target: TestTarget;
	completedCount: number;
	totalCount: number;
	onCancel: () => void;
}) {
	const progress = totalCount > 0 ? completedCount / totalCount : 0;
	return (
		<div className='flex flex-col gap-2 rounded-xl border p-4'>
			<div className='flex items-center justify-between gap-3'>
				<div className='text-sm'>
					Running {totalCount} checks on <TargetLabel target={target} />
					<span className='ml-2 text-xs text-muted-foreground tabular-nums'>
						{completedCount}/{totalCount} done
					</span>
				</div>
				<Button size='sm' variant='ghost-muted' onClick={onCancel}>
					<Square />
					Stop
				</Button>
			</div>
			<div className='h-1.5 overflow-hidden rounded-full bg-muted'>
				<div
					className='h-full rounded-full bg-primary transition-[width] duration-300'
					style={{ width: `${progress * 100}%` }}
				/>
			</div>
			<p className='text-xs text-muted-foreground'>
				You can leave this page. Results are kept and you will get a notification when the run finishes.
			</p>
		</div>
	);
}

function ResultsOverview({
	summaries,
	isRunning,
	target,
}: {
	summaries: TestResultSummary[];
	isRunning: boolean;
	target: TestTarget;
}) {
	const passedRuns = summaries.reduce((total, summary) => total + summary.passedCount, 0);
	const finishedRuns = summaries.reduce((total, summary) => total + summary.finishedCount, 0);
	const reliability = finishedRuns > 0 ? passedRuns / finishedRuns : null;
	const baselines = summaries.flatMap((summary) => (summary.baseline === null ? [] : [summary.baseline]));
	const baseline =
		baselines.length > 0 ? baselines.reduce((total, rate) => total + rate, 0) / baselines.length : null;
	const delta = reliability !== null && baseline !== null ? reliability - baseline : null;
	const countOf = (verdict: TestVerdict) => summaries.filter((summary) => summary.verdict === verdict).length;

	return (
		<div className='grid grid-cols-3 divide-x rounded-xl border'>
			<OverviewTile label={isRunning ? 'Reliability so far' : `Reliability on ${describeTarget(target)}`}>
				<ReliabilityValue rate={reliability} className='text-2xl font-semibold' />
				<span className='text-xs text-muted-foreground'>
					{passedRuns} of {finishedRuns} runs passed
				</span>
			</OverviewTile>
			<OverviewTile label='Compared with production'>
				{delta === null ? (
					<span className='text-2xl font-semibold text-muted-foreground'>—</span>
				) : (
					<span className={cn('text-2xl font-semibold tabular-nums', deltaTextClass(delta))}>
						{formatDelta(delta)}
					</span>
				)}
				<span className='text-xs text-muted-foreground'>
					{baseline === null ? 'No production history yet' : `Production is at ${formatPercent(baseline)}`}
				</span>
			</OverviewTile>
			<OverviewTile label='Questions'>
				<div className='flex flex-wrap items-center gap-1.5 pt-1'>
					{isRunning ? (
						<span className='text-sm text-muted-foreground'>{countOf('running')} still running</span>
					) : (
						<>
							<VerdictBadge verdict='regressed' count={countOf('regressed')} />
							<VerdictBadge verdict='improved' count={countOf('improved')} />
							<VerdictBadge verdict='stable' count={countOf('stable')} />
							<VerdictBadge verdict='new' count={countOf('new')} />
						</>
					)}
				</div>
			</OverviewTile>
		</div>
	);
}

function OverviewTile({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className='flex min-w-0 flex-col gap-1 p-4'>
			<span className='truncate text-xs text-muted-foreground'>{label}</span>
			{children}
		</div>
	);
}

const verdictLabels: Record<TestVerdict, string> = {
	running: 'Running',
	regressed: 'Regressed',
	new: 'New',
	improved: 'Improved',
	stable: 'Stable',
};

const verdictBadgeClasses: Record<TestVerdict, string> = {
	running: 'bg-muted text-muted-foreground',
	regressed: 'bg-destructive/10 text-destructive',
	new: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
	improved: 'bg-green-500/10 text-green-600 dark:text-green-500',
	stable: 'bg-muted text-muted-foreground',
};

function VerdictBadge({ verdict, count }: { verdict: TestVerdict; count?: number }) {
	if (count === 0) {
		return null;
	}
	return (
		<Badge variant='ghost' className={verdictBadgeClasses[verdict]}>
			{count !== undefined && <span className='tabular-nums'>{count}</span>}
			{verdictLabels[verdict].toLowerCase()}
		</Badge>
	);
}

function TestResultRow({ summary, defaultOpen }: { summary: TestResultSummary; defaultOpen: boolean }) {
	const [isOpen, setIsOpen] = useState(defaultOpen);
	const failures = summary.outcomes.filter((outcome) => outcome.status === 'failed');
	const canExpand = failures.length > 0;
	const delta = summary.rate !== null && summary.baseline !== null ? summary.rate - summary.baseline : null;

	return (
		<li className={cn(summary.verdict === 'regressed' && 'bg-destructive/[0.03]')}>
			<button
				type='button'
				disabled={!canExpand}
				onClick={() => setIsOpen(!isOpen)}
				aria-expanded={canExpand ? isOpen : undefined}
				className={cn(
					'grid w-full grid-cols-[1rem_1fr_6rem_4.5rem_5.5rem_10rem] items-center gap-3 px-4 py-2.5 text-left',
					canExpand && 'cursor-pointer hover:bg-accent/40',
				)}
			>
				<ChevronRight
					className={cn(
						'size-3.5 text-muted-foreground transition-transform',
						isOpen && 'rotate-90',
						!canExpand && 'invisible',
					)}
				/>
				<div className='flex min-w-0 flex-col gap-0.5'>
					<div className='flex items-center gap-2'>
						<span className='truncate font-mono text-xs font-medium'>{summary.test.name}</span>
						{summary.test.isDraft && <Badge variant='context_admin'>Draft</Badge>}
					</div>
					<span className='truncate text-sm text-muted-foreground'>{summary.test.prompt}</span>
				</div>
				<RunDots outcomes={summary.outcomes} />
				<div className='text-right'>
					{summary.rate === null ? (
						<span className='text-xs text-muted-foreground'>…</span>
					) : (
						<span className={cn('text-sm font-medium tabular-nums', reliabilityTextClass(summary.rate))}>
							{summary.passedCount}/{summary.finishedCount}
						</span>
					)}
				</div>
				<div className='text-right'>
					<ReliabilityValue rate={summary.baseline} className='text-muted-foreground' />
				</div>
				<div className='flex items-center justify-end gap-1.5'>
					{summary.verdict !== 'running' && <VerdictBadge verdict={summary.verdict} />}
					{delta !== null && summary.verdict !== 'running' && summary.verdict !== 'stable' && (
						<span className={cn('whitespace-nowrap text-xs tabular-nums', deltaTextClass(delta))}>
							{formatDelta(delta)}
						</span>
					)}
				</div>
			</button>
			{isOpen && canExpand && (
				<ul className='flex flex-col gap-2 px-4 pb-3 pl-11'>
					{failures.map((failure) => (
						<li
							key={failure.runIndex}
							className='flex items-start justify-between gap-3 rounded-lg border bg-background p-3'
						>
							<div className='flex flex-col gap-0.5'>
								<span className='text-xs font-medium text-destructive'>
									Run {failure.runIndex + 1} failed · {failure.durationSeconds}s
								</span>
								<span className='text-sm'>{failure.failureReason}</span>
							</div>
							<Button size='sm' variant='ghost-muted' className='shrink-0'>
								<ExternalLink />
								Open chat
							</Button>
						</li>
					))}
				</ul>
			)}
		</li>
	);
}

function RunDots({ outcomes }: { outcomes: TestRunOutcome[] }) {
	return (
		<div className='flex flex-wrap items-center gap-1'>
			{outcomes.map((outcome) => (
				<span
					key={outcome.runIndex}
					title={`Run ${outcome.runIndex + 1}: ${outcome.status}`}
					className={cn(
						'size-2.5 rounded-full',
						outcome.status === 'pending' && 'border border-dashed border-muted-foreground/40',
						outcome.status === 'running' && 'animate-pulse bg-primary/50',
						outcome.status === 'passed' && 'bg-green-500',
						outcome.status === 'failed' && 'bg-destructive',
					)}
				/>
			))}
		</div>
	);
}

function DraftsCallout({
	draftTests,
	summaries,
	target,
	onSave,
}: {
	draftTests: ContextTest[];
	summaries: TestResultSummary[];
	target: TestTarget;
	onSave: () => void;
}) {
	const draftIds = new Set(draftTests.map((test) => test.id));
	const draftSummaries = summaries.filter((summary) => draftIds.has(summary.test.id));
	const allPassing = draftSummaries.every((summary) => summary.rate === 1);

	return (
		<div className='flex items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4'>
			<div className='flex items-start gap-3'>
				<FilePlus2 className='mt-0.5 size-4 shrink-0 text-amber-500' />
				<div className='flex flex-col gap-0.5'>
					<span className='text-sm font-medium'>
						{draftTests.length === 1
							? '1 new question is not in the test suite yet'
							: `${draftTests.length} new questions are not in the test suite yet`}
					</span>
					<span className='text-xs text-muted-foreground'>
						{allPassing
							? 'It passed every run. Save it so the next context change is checked against it.'
							: 'Some runs failed. That can be the point: save it to track the fix, or adjust the expected answer first.'}
					</span>
				</div>
			</div>
			<Button size='sm' onClick={onSave} className='shrink-0'>
				<GitCommitHorizontal />
				{target.kind === 'branch' ? `Save to ${target.ref}` : 'Propose for review'}
			</Button>
		</div>
	);
}

function SavedDraftsNotice({ names, target }: { names: string[]; target: TestTarget }) {
	return (
		<div className='flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-500/5 p-4 text-sm'>
			<GitCommitHorizontal className='mt-0.5 size-4 shrink-0 text-green-600' />
			<div className='flex flex-col gap-0.5'>
				<span className='font-medium'>
					{target.kind === 'branch' ? `Committed to ${target.ref}` : 'Review request opened'}
				</span>
				<span className='font-mono text-xs text-muted-foreground'>
					{names.map((name) => `tests/${name}.yml`).join(', ')}
				</span>
			</div>
		</div>
	);
}

function formatDelta(delta: number): string {
	const points = Math.round(delta * 100);
	return `${points > 0 ? '+' : points < 0 ? '−' : '±'}${Math.abs(points)} pts`;
}

function deltaTextClass(delta: number): string {
	if (delta <= -0.05) {
		return 'text-destructive';
	}
	if (delta >= 0.05) {
		return 'text-green-600 dark:text-green-500';
	}
	return 'text-muted-foreground';
}
