import { useSyncExternalStore } from 'react';
import { Store } from './abstract-store';
import type { ContextTest, TestOwner, TestRun } from '@/lib/context-tests';
import { buildRunResults, getBaselinePassRate, getTableFromContextPath } from '@/lib/context-tests';
import { MOCK_DRAFT_PASS_RATES, MOCK_OWNERS, MOCK_REF_PASS_RATES, MOCK_TESTS } from '@/lib/context-tests-mock';

interface ContextTestsState {
	tests: ContextTest[];
	owners: TestOwner[];
	suiteRuns: Record<string, TestRun>;
	draftRuns: Record<string, TestRun>;
	draftFilePath: string | null;
}

interface DraftRunRequest {
	filePath: string;
	testIds: string[];
	runsPerTest: number;
	hasUnsavedEdits: boolean;
}

interface SuiteRunRequest {
	testIds: string[];
	runsPerTest: number;
	refId: string;
	isProduction: boolean;
}

const RUN_STAGGER_MS = 450;
const RUN_DURATION_MS = 1100;
const UNKNOWN_PASS_RATE = 2 / 3;

class ContextTestsStore extends Store<ContextTestsState> {
	protected state: ContextTestsState = {
		tests: MOCK_TESTS,
		owners: MOCK_OWNERS,
		suiteRuns: {},
		draftRuns: {},
		draftFilePath: null,
	};

	getSnapshot = () => this.state;

	saveTest = (test: ContextTest) => {
		const exists = this.state.tests.some((existing) => existing.id === test.id);
		const tests = exists
			? this.state.tests.map((existing) => (existing.id === test.id ? test : existing))
			: [test, ...this.state.tests];
		this.setState({ tests });
	};

	deleteTest = (testId: string) => {
		this.setState({ tests: this.state.tests.filter((test) => test.id !== testId) });
	};

	ensureOwner = (owner: TestOwner) => {
		if (this.state.owners.some((existing) => existing.id === owner.id)) {
			return;
		}
		this.setState({ owners: [...this.state.owners, owner] });
	};

	runAgainstDraft = ({ filePath, testIds, runsPerTest, hasUnsavedEdits }: DraftRunRequest) => {
		const table = getTableFromContextPath(filePath);
		const ref = hasUnsavedEdits ? 'draft' : 'saved';
		if (this.state.draftFilePath !== filePath) {
			this.setState({ draftFilePath: filePath, draftRuns: {} });
		}
		this.scheduleRuns('draftRuns', testIds, runsPerTest, ref, '', (test) => {
			const draftRate = hasUnsavedEdits && table ? MOCK_DRAFT_PASS_RATES[table]?.[test.name] : undefined;
			return draftRate ?? getBaselinePassRate(test) ?? UNKNOWN_PASS_RATE;
		});
	};

	runSuite = ({ testIds, runsPerTest, refId, isProduction }: SuiteRunRequest) => {
		this.scheduleRuns(
			'suiteRuns',
			testIds,
			runsPerTest,
			refId,
			getSuiteRunKeyPrefix(refId),
			(test) => MOCK_REF_PASS_RATES[refId]?.[test.name] ?? getBaselinePassRate(test) ?? UNKNOWN_PASS_RATE,
			isProduction ? this.recordBaseline : undefined,
		);
	};

	private scheduleRuns(
		key: 'draftRuns' | 'suiteRuns',
		testIds: string[],
		runsPerTest: number,
		ref: string,
		keyPrefix: string,
		getPassRate: (test: ContextTest) => number,
		onDone?: (testId: string, run: TestRun) => void,
	) {
		const queued = Object.fromEntries(
			testIds.map((id) => [
				`${keyPrefix}${id}`,
				{ status: 'queued', results: [], runs: runsPerTest, ref, ranAt: null } as TestRun,
			]),
		);
		this.setState({ [key]: { ...this.state[key], ...queued } });

		testIds.forEach((testId, index) => {
			const startDelay = index * RUN_STAGGER_MS;
			setTimeout(() => this.updateRun(key, `${keyPrefix}${testId}`, { status: 'running' }), startDelay);
			setTimeout(() => {
				const test = this.state.tests.find((candidate) => candidate.id === testId);
				if (!test) {
					return;
				}
				const results = buildRunResults(getPassRate(test), runsPerTest, `${ref}:${testId}:${runsPerTest}`);
				const run: TestRun = {
					status: 'done',
					results,
					runs: runsPerTest,
					ref,
					ranAt: new Date().toISOString(),
				};
				this.updateRun(key, `${keyPrefix}${testId}`, run);
				onDone?.(testId, run);
			}, startDelay + RUN_DURATION_MS);
		});
	}

	private recordBaseline = (testId: string, run: TestRun) => {
		const passes = run.results.filter(Boolean).length;
		this.setState({
			tests: this.state.tests.map((test) =>
				test.id === testId
					? { ...test, baseline: { passes, runs: run.results.length, ref: run.ref, ranAt: run.ranAt ?? '' } }
					: test,
			),
		});
	};

	private updateRun(key: 'draftRuns' | 'suiteRuns', runKey: string, patch: Partial<TestRun>) {
		const current = this.state[key][runKey];
		if (!current) {
			return;
		}
		this.setState({ [key]: { ...this.state[key], [runKey]: { ...current, ...patch } } });
	}

	private setState(patch: Partial<ContextTestsState>) {
		this.state = { ...this.state, ...patch };
		this.notify();
	}
}

export const contextTestsStore = new ContextTestsStore();

export function getSuiteRunKeyPrefix(refId: string): string {
	return `${refId}::`;
}

export const useContextTests = () => useSyncExternalStore(contextTestsStore.subscribe, contextTestsStore.getSnapshot);
