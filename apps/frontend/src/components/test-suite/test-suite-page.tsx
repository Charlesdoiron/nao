import { Plus, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { TestDetailPanel } from './test-detail-panel';
import { TestEditorDialog } from './test-editor-dialog';
import { TestFilterBar } from './test-filter-bar';
import { TestRunTargetBar } from './test-run-target-bar';
import { TestSelectionBar } from './test-selection-bar';
import { CURRENT_USER, GIT_REFS, OWNERS, PRODUCTION_REF_ID } from './test-suite-mock-data';
import { TestSuiteSummary } from './test-suite-summary';
import { TestSuiteTable } from './test-suite-table';
import {
	applyTestFilters,
	collectTags,
	EMPTY_FILTERS,
	getSuiteRate,
	getTestStatus,
	inferTagsFromName,
	existsOnRef,
	isLikelyAffected,
} from './test-suite-utils';
import { useTestSuite } from './use-test-suite';
import type { ChangeEvent } from 'react';
import type { TestEditorSubmit } from './test-editor-dialog';
import type { RunsPerTest } from './test-run-target-bar';
import type { SuiteSummary } from './test-suite-summary';
import type { GitRef, SuiteTest, TestDraft, TestFilters, TestStatus } from './test-suite-types';

import { MobileHeader } from '@/components/mobile-header';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

const DEFAULT_CANDIDATE_REF_ID = 'feature/arr-definitions';

const STATUS_PRIORITY: Record<TestStatus, number> = {
	regressed: 0,
	flaky: 1,
	failing: 2,
	improved: 3,
	'not-run': 4,
	passing: 5,
};

export function TestSuitePage() {
	const suite = useTestSuite();
	const [candidateRefId, setCandidateRefId] = useState(DEFAULT_CANDIDATE_REF_ID);
	const [runsPerTest, setRunsPerTest] = useState<RunsPerTest>('3');
	const [includeBaseline, setIncludeBaseline] = useState(false);
	const [filters, setFilters] = useState<TestFilters>(EMPTY_FILTERS);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [activeTestId, setActiveTestId] = useState<string | null>(null);
	const [editor, setEditor] = useState<{ open: boolean; testId: string | null }>({ open: false, testId: null });
	const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const baselineRef = GIT_REFS.find((ref) => ref.id === PRODUCTION_REF_ID)!;
	const candidateRef = GIT_REFS.find((ref) => ref.id === candidateRefId) ?? baselineRef;
	const isComparing = candidateRef.id !== baselineRef.id;
	const branches = GIT_REFS.filter((ref) => ref.kind === 'branch');
	const runCount = Number(runsPerTest);

	const statusOf = (test: SuiteTest) => getTestStatus(test, baselineRef.id, candidateRef.id);
	const allTests = useStatusOrderedTests(suite.tests, statusOf, `${baselineRef.id}:${candidateRef.id}`);

	const filteredTests = applyTestFilters(allTests, filters, statusOf, candidateRef);
	const testsIgnoringStatus = applyTestFilters(allTests, { ...filters, status: 'all' }, statusOf, candidateRef);
	const summary = buildSummary(testsIgnoringStatus, baselineRef.id, candidateRef, statusOf);
	const likelyAffectedCount = allTests.filter((test) => isLikelyAffected(test, candidateRef)).length;
	const tagCounts = collectTags(suite.tests);
	const activeTest = suite.tests.find((test) => test.id === activeTestId) ?? null;
	const editingTest = suite.tests.find((test) => test.id === editor.testId) ?? null;

	const visibleSelectedIds = selectedIds.filter((id) => filteredTests.some((test) => test.id === id));
	const runScopeIds = visibleSelectedIds.length > 0 ? visibleSelectedIds : filteredTests.map((test) => test.id);
	const runScopeLabel = buildRunScopeLabel(visibleSelectedIds.length, filteredTests.length, suite.tests.length);

	function refsToRun(forceBoth = false): string[] {
		if (!isComparing) {
			return [baselineRef.id];
		}
		return includeBaseline || forceBoth ? [baselineRef.id, candidateRef.id] : [candidateRef.id];
	}

	function runTests(testIds: string[], refIds: string[]) {
		refIds.forEach((refId) => {
			const runnableIds = testIds.filter((id) => {
				const test = suite.tests.find((candidate) => candidate.id === id);
				return test ? existsOnRef(test, refId) : false;
			});
			suite.runTests(runnableIds, [refId], runCount);
		});
	}

	function handleCandidateChange(refId: string) {
		const nextRef = GIT_REFS.find((ref) => ref.id === refId);
		setCandidateRefId(refId);
		setFilters((current) => ({
			...current,
			status: 'all',
			onlyLikelyAffected: nextRef?.changedContextFiles.length ? current.onlyLikelyAffected : false,
		}));
	}

	function handleEditorSubmit({ draft, refId, runAfterSave }: TestEditorSubmit) {
		const id = suite.saveTest(draft, { existingId: editor.testId ?? undefined, refId });
		setEditor({ open: false, testId: null });
		setActiveTestId(id);
		if (runAfterSave) {
			const isOnProduction = editingTest !== null && existsOnRef(editingTest, baselineRef.id);
			suite.runTests([id], isOnProduction ? refsToRun(true) : [refId], runCount);
		}
	}

	async function handleImportFiles(event: ChangeEvent<HTMLInputElement>) {
		const files = Array.from(event.target.files ?? []);
		event.target.value = '';
		const drafts = await Promise.all(files.map(readTestFile));
		const targetRefId = candidateRef.kind === 'branch' ? candidateRef.id : baselineRef.id;
		drafts.forEach((draft) => suite.saveTest(draft, { refId: targetRefId }));
	}

	function confirmDelete() {
		suite.deleteTests(pendingDeleteIds);
		setSelectedIds((current) => current.filter((id) => !pendingDeleteIds.includes(id)));
		if (activeTestId && pendingDeleteIds.includes(activeTestId)) {
			setActiveTestId(null);
		}
		setPendingDeleteIds([]);
	}

	return (
		<div className='flex h-full flex-1 flex-col overflow-auto bg-background'>
			<MobileHeader />
			<div className='mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-8 md:py-10'>
				<header className='flex flex-wrap items-center justify-between gap-3'>
					<div>
						<h1 className='text-xl font-semibold tracking-tight'>Tests</h1>
						<p className='text-sm text-muted-foreground'>
							Run your test questions against production or a working branch, without a local setup.
						</p>
					</div>
					<div className='flex items-center gap-2'>
						<input
							ref={fileInputRef}
							type='file'
							accept='.yml,.yaml'
							multiple
							className='hidden'
							onChange={handleImportFiles}
						/>
						<Button variant='outline' onClick={() => fileInputRef.current?.click()}>
							<Upload />
							Import YAML
						</Button>
						<Button variant='primary-gradient' onClick={() => setEditor({ open: true, testId: null })}>
							<Plus />
							New test
						</Button>
					</div>
				</header>

				<TestRunTargetBar
					refs={GIT_REFS}
					baselineRef={baselineRef}
					candidateRef={candidateRef}
					onCandidateChange={handleCandidateChange}
					runsPerTest={runsPerTest}
					onRunsPerTestChange={setRunsPerTest}
					includeBaseline={includeBaseline}
					onIncludeBaselineChange={setIncludeBaseline}
					runScopeCount={runScopeIds.length}
					runScopeLabel={runScopeLabel}
					isRunning={suite.runningCount > 0}
					onRun={() => runTests(runScopeIds, refsToRun())}
				/>

				<TestSuiteSummary
					summary={summary}
					activeStatus={filters.status}
					onStatusSelect={(status) => setFilters((current) => ({ ...current, status }))}
				/>

				<div className='flex flex-col gap-3'>
					<div className='flex flex-wrap items-center justify-between gap-2'>
						<TestFilterBar
							filters={filters}
							onChange={setFilters}
							tagCounts={tagCounts}
							owners={OWNERS}
							candidateRef={candidateRef}
							isComparing={isComparing}
							likelyAffectedCount={likelyAffectedCount}
						/>
						<span className='text-xs text-muted-foreground tabular-nums'>
							{filteredTests.length} of {suite.tests.length} tests
						</span>
					</div>
					<TestSuiteTable
						tests={filteredTests}
						baselineRef={baselineRef}
						candidateRef={candidateRef}
						statusOf={statusOf}
						isRunning={suite.isRunning}
						runsPerTest={runCount}
						selectedIds={selectedIds}
						onSelectionChange={setSelectedIds}
						activeTestId={activeTestId}
						onOpenTest={setActiveTestId}
						onRunTest={(testId) => runTests([testId], refsToRun())}
						onEditTest={(testId) => setEditor({ open: true, testId })}
						onDeleteTest={(testId) => setPendingDeleteIds([testId])}
					/>
				</div>

				<TestSelectionBar
					count={visibleSelectedIds.length}
					existingTags={[...tagCounts.keys()]}
					onRun={() => runTests(visibleSelectedIds, refsToRun())}
					onAddTag={(tag) => suite.addTag(visibleSelectedIds, tag)}
					onDelete={() => setPendingDeleteIds(visibleSelectedIds)}
					onClear={() => setSelectedIds([])}
				/>
			</div>

			{activeTest && (
				<TestDetailPanel
					test={activeTest}
					status={statusOf(activeTest)}
					baselineRef={baselineRef}
					candidateRef={candidateRef}
					isRunning={suite.isRunning}
					runsPerTest={runCount}
					onClose={() => setActiveTestId(null)}
					onRun={() => runTests([activeTest.id], refsToRun(true))}
					onEdit={() => setEditor({ open: true, testId: activeTest.id })}
					onRemoveTag={(tag) => suite.removeTag(activeTest.id, tag)}
				/>
			)}

			<TestEditorDialog
				open={editor.open}
				onOpenChange={(open) => setEditor((current) => ({ ...current, open }))}
				test={editingTest}
				branches={branches}
				defaultRefId={candidateRef.kind === 'branch' ? candidateRef.id : baselineRef.id}
				defaultOwner={CURRENT_USER}
				runsPerTest={runCount}
				onSubmit={handleEditorSubmit}
			/>

			<ConfirmationDialog
				open={pendingDeleteIds.length > 0}
				onOpenChange={(open) => !open && setPendingDeleteIds([])}
				title={pendingDeleteIds.length > 1 ? `Delete ${pendingDeleteIds.length} tests?` : 'Delete test?'}
				description={`This removes the YAML file${pendingDeleteIds.length > 1 ? 's' : ''} from ${
					candidateRef.kind === 'branch' ? candidateRef.name : baselineRef.name
				} in a new commit. Past results stay in run history.`}
				confirmLabel='Delete'
				onConfirm={confirmDelete}
			/>
		</div>
	);
}

/**
 * Orders tests by status once per compared ref, then keeps that order so rows do not
 * jump around while runs complete. Tests added afterwards are shown on top.
 */
function useStatusOrderedTests(
	tests: SuiteTest[],
	statusOf: (test: SuiteTest) => TestStatus,
	orderKey: string,
): SuiteTest[] {
	const [order, setOrder] = useState(() => ({ key: orderKey, ids: rankByStatus(tests, statusOf) }));
	if (order.key !== orderKey) {
		setOrder({ key: orderKey, ids: rankByStatus(tests, statusOf) });
	}
	const testsById = new Map(tests.map((test) => [test.id, test]));
	const ranked = order.ids.flatMap((id) => testsById.get(id) ?? []);
	const added = tests.filter((test) => !order.ids.includes(test.id));
	return [...added, ...ranked];
}

function rankByStatus(tests: SuiteTest[], statusOf: (test: SuiteTest) => TestStatus): string[] {
	return [...tests]
		.sort((a, b) => STATUS_PRIORITY[statusOf(a)] - STATUS_PRIORITY[statusOf(b)] || a.name.localeCompare(b.name))
		.map((test) => test.id);
}

function buildSummary(
	tests: SuiteTest[],
	baselineRefId: string,
	candidateRef: GitRef,
	statusOf: (test: SuiteTest) => TestStatus,
): SuiteSummary {
	const isComparing = candidateRef.id !== baselineRefId;
	const comparable = isComparing
		? tests.filter((test) => test.results[baselineRefId] && test.results[candidateRef.id])
		: tests;
	const statusCounts: Record<TestStatus, number> = {
		regressed: 0,
		improved: 0,
		flaky: 0,
		failing: 0,
		passing: 0,
		'not-run': 0,
	};
	tests.forEach((test) => {
		statusCounts[statusOf(test)] += 1;
	});
	return {
		baselineRate: getSuiteRate(comparable, baselineRefId),
		candidateRate: isComparing ? getSuiteRate(comparable, candidateRef.id) : null,
		statusCounts,
		isComparing,
		candidateName: candidateRef.name,
		candidateKind: candidateRef.kind,
	};
}

function buildRunScopeLabel(selectedCount: number, filteredCount: number, totalCount: number): string {
	if (selectedCount > 0) {
		return `Run ${selectedCount} selected`;
	}
	if (filteredCount === totalCount) {
		return `Run all ${totalCount} tests`;
	}
	return `Run ${filteredCount} filtered tests`;
}

async function readTestFile(file: File): Promise<TestDraft> {
	const content = await file.text();
	const name = readYamlField(content, 'name') ?? file.name.replace(/\.ya?ml$/, '');
	return {
		name,
		prompt: readYamlField(content, 'prompt') ?? '',
		sql: readYamlBlock(content, 'sql') ?? '',
		tags: inferTagsFromName(name),
		owner: CURRENT_USER,
	};
}

function readYamlField(content: string, key: string): string | null {
	const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
	return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
}

function readYamlBlock(content: string, key: string): string | null {
	const match = content.match(new RegExp(`^${key}:\\s*\\|\\s*\\n((?:\\s{2,}.*\\n?)+)`, 'm'));
	return match ? match[1].replace(/^\s{2}/gm, '').trim() : readYamlField(content, key);
}
