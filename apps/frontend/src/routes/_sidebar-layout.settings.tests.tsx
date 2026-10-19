import { createFileRoute } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Play } from 'lucide-react';
import { useRef, useState } from 'react';

import type { ContextTest, TestTarget } from '@/components/context-tests/context-tests.mock';
import type { TestFilters } from '@/components/context-tests/context-tests-questions-step';
import type { TestFlowStep } from '@/components/context-tests/context-tests-stepper';

import {
	PRODUCTION_DEPLOYMENT,
	changedFilesForTarget,
	describeTarget,
	initialContextTests,
	isTestLikelyAffected,
} from '@/components/context-tests/context-tests.mock';
import { ContextTestsAddQuestionDialog } from '@/components/context-tests/context-tests-add-question-dialog';
import { ContextTestsQuestionsStep, emptyTestFilters } from '@/components/context-tests/context-tests-questions-step';
import { ContextTestsReviewStep } from '@/components/context-tests/context-tests-review-step';
import { ContextTestsRunsStep } from '@/components/context-tests/context-tests-runs-step';
import { ContextTestsStepper, testFlowSteps } from '@/components/context-tests/context-tests-stepper';
import { ContextTestsTargetStep } from '@/components/context-tests/context-tests-target-step';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SettingsPageWrapper } from '@/components/ui/settings-card';
import { useContextTestRun } from '@/hooks/use-context-test-run';
import { requireContextAdminOrAdmin } from '@/lib/route-guards';

export const Route = createFileRoute('/_sidebar-layout/settings/tests')({
	beforeLoad: requireContextAdminOrAdmin,
	component: ContextTestsPage,
});

const stepHeadings: Record<TestFlowStep, { title: string; description: string }> = {
	target: {
		title: 'Which context do you want to test?',
		description: 'Pick the live deployment, or a branch with context changes that are not merged yet.',
	},
	questions: {
		title: 'Which questions should run?',
		description: 'Filter by name, tag or owner, then select the questions to run. Add one if it is missing.',
	},
	runs: {
		title: 'How many times should each question run?',
		description: 'Answers vary from one run to the next, so one pass or fail says little on its own.',
	},
	review: {
		title: 'Results',
		description: 'Reliability per question, compared with production. Open a row to see why runs failed.',
	},
};

function ContextTestsPage() {
	const [step, setStep] = useState<TestFlowStep>('target');
	const [target, setTarget] = useState<TestTarget>({ kind: 'production', ref: PRODUCTION_DEPLOYMENT.ref });
	const [tests, setTests] = useState<ContextTest[]>(initialContextTests);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [filters, setFilters] = useState<TestFilters>(emptyTestFilters);
	const [repeats, setRepeats] = useState(3);
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [runTestIds, setRunTestIds] = useState<string[]>([]);
	const [savedDraftNames, setSavedDraftNames] = useState<string[]>([]);
	const lastPreselectedTarget = useRef<string | null>(null);
	const run = useContextTestRun();

	const selectedTests = tests.filter((test) => selectedIds.has(test.id));
	const runTests = runTestIds.flatMap((id) => tests.find((test) => test.id === id) ?? []);
	const hasStartedRun = run.totalCount > 0;
	const reachableSteps: TestFlowStep[] = [
		'target',
		'questions',
		...(selectedIds.size > 0 ? (['runs'] as const) : []),
		...(hasStartedRun ? (['review'] as const) : []),
	];

	const preselectLikelyAffected = () => {
		const targetKey = `${target.kind}:${target.ref}`;
		if (target.kind !== 'branch' || lastPreselectedTarget.current === targetKey) {
			return;
		}
		lastPreselectedTarget.current = targetKey;
		const changedFiles = changedFilesForTarget(target);
		setSelectedIds(
			new Set(tests.filter((test) => isTestLikelyAffected(test, changedFiles)).map((test) => test.id)),
		);
	};

	const startRun = (testIds: string[]) => {
		setRunTestIds(testIds);
		run.start(
			tests.filter((test) => testIds.includes(test.id)),
			target,
			repeats,
		);
		setStep('review');
	};

	const addQuestion = (test: ContextTest) => {
		setTests((current) => [test, ...current]);
		setSelectedIds((current) => new Set([...current, test.id]));
		setIsAddDialogOpen(false);
	};

	const updateTestTags = (testId: string, tags: string[]) =>
		setTests((current) => current.map((test) => (test.id === testId ? { ...test, tags } : test)));

	const saveDrafts = (testIds: string[]) => {
		setSavedDraftNames(tests.filter((test) => testIds.includes(test.id)).map((test) => test.name));
		setTests((current) => current.map((test) => (testIds.includes(test.id) ? { ...test, isDraft: false } : test)));
	};

	const goToNextStep = () => {
		if (step === 'target') {
			preselectLikelyAffected();
			setStep('questions');
		} else if (step === 'questions') {
			setStep('runs');
		} else if (step === 'runs') {
			startRun([...selectedIds]);
		}
	};

	const goToPreviousStep = () => {
		const index = testFlowSteps.findIndex((flowStep) => flowStep.id === step);
		setStep(testFlowSteps[Math.max(0, index - 1)].id);
	};

	const heading = stepHeadings[step];

	return (
		<div className='flex min-h-0 flex-1 flex-col'>
			<SettingsPageWrapper>
				<div className='flex flex-col gap-6'>
					<div className='flex items-start justify-between gap-4'>
						<div>
							<div className='flex items-center gap-2'>
								<h1 className='text-lg font-semibold text-foreground'>Tests</h1>
								<Badge variant='admin'>Beta</Badge>
							</div>
							<p className='text-sm text-muted-foreground'>
								Check how reliably nao answers your test questions before context changes reach users.
								No local setup needed.
							</p>
						</div>
						<div className='shrink-0 text-right text-xs text-muted-foreground'>
							<div>{tests.filter((test) => !test.isDraft).length} questions in the suite</div>
							<div>Last full run: yesterday · 86%</div>
						</div>
					</div>

					<div className='rounded-xl border bg-muted/30 p-2'>
						<ContextTestsStepper activeStep={step} reachableSteps={reachableSteps} onStepChange={setStep} />
					</div>

					<section className='flex flex-col gap-4'>
						<div>
							<h2 className='text-base font-semibold'>{heading.title}</h2>
							<p className='text-xs text-muted-foreground'>{heading.description}</p>
						</div>

						{step === 'target' && (
							<ContextTestsTargetStep target={target} tests={tests} onTargetChange={setTarget} />
						)}
						{step === 'questions' && (
							<ContextTestsQuestionsStep
								tests={tests}
								target={target}
								selectedIds={selectedIds}
								filters={filters}
								onSelectedIdsChange={setSelectedIds}
								onFiltersChange={setFilters}
								onTestTagsChange={updateTestTags}
								onAddQuestion={() => setIsAddDialogOpen(true)}
							/>
						)}
						{step === 'runs' && (
							<ContextTestsRunsStep
								repeats={repeats}
								questionCount={selectedIds.size}
								onRepeatsChange={setRepeats}
							/>
						)}
						{step === 'review' && (
							<ContextTestsReviewStep
								tests={runTests}
								target={target}
								outcomes={run.outcomes}
								isRunning={run.isRunning}
								completedCount={run.completedCount}
								totalCount={run.totalCount}
								savedDraftNames={savedDraftNames}
								onCancel={run.cancel}
								onRerun={startRun}
								onEditQuestions={() => setStep('questions')}
								onSaveDrafts={saveDrafts}
							/>
						)}
					</section>
				</div>
			</SettingsPageWrapper>

			{step !== 'review' && (
				<StepFooter
					step={step}
					summary={`${describeTarget(target)} · ${selectedTests.length} ${selectedTests.length === 1 ? 'question' : 'questions'} · ${repeats} runs each`}
					totalRuns={selectedTests.length * repeats}
					canContinue={step === 'target' || selectedIds.size > 0}
					onBack={goToPreviousStep}
					onContinue={goToNextStep}
				/>
			)}

			<ContextTestsAddQuestionDialog
				open={isAddDialogOpen}
				onOpenChange={setIsAddDialogOpen}
				onAdd={addQuestion}
			/>
		</div>
	);
}

function StepFooter({
	step,
	summary,
	totalRuns,
	canContinue,
	onBack,
	onContinue,
}: {
	step: TestFlowStep;
	summary: string;
	totalRuns: number;
	canContinue: boolean;
	onBack: () => void;
	onContinue: () => void;
}) {
	return (
		<div className='border-t bg-background'>
			<div className='mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-3 md:px-8'>
				<span className='truncate text-xs text-muted-foreground'>{summary}</span>
				<div className='flex items-center gap-2'>
					{step !== 'target' && (
						<Button variant='ghost' size='sm' onClick={onBack}>
							<ArrowLeft />
							Back
						</Button>
					)}
					<Button size='sm' onClick={onContinue} disabled={!canContinue}>
						{step === 'runs' ? (
							<>
								<Play />
								Start {totalRuns} runs
							</>
						) : (
							<>
								Continue
								<ArrowRight />
							</>
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
