import { useCallback, useEffect, useRef, useState } from 'react';

import type { ContextTest, TestTarget } from '@/components/context-tests/context-tests.mock';

import {
	PARALLEL_RUNS,
	mockFailureReason,
	mockRunDurationMs,
	mockRunPasses,
} from '@/components/context-tests/context-tests.mock';

export type TestRunStatus = 'pending' | 'running' | 'passed' | 'failed';

export interface TestRunOutcome {
	testId: string;
	runIndex: number;
	status: TestRunStatus;
	durationSeconds?: number;
	failureReason?: string;
}

interface ScheduledRun {
	test: ContextTest;
	runIndex: number;
	startAtMs: number;
	durationMs: number;
}

export function useContextTestRun() {
	const [outcomes, setOutcomes] = useState<TestRunOutcome[]>([]);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const clearTimers = useCallback(() => {
		timersRef.current.forEach(clearTimeout);
		timersRef.current = [];
	}, []);

	useEffect(() => clearTimers, [clearTimers]);

	const updateOutcome = useCallback((index: number, patch: Partial<TestRunOutcome>) => {
		setOutcomes((current) => current.map((outcome, i) => (i === index ? { ...outcome, ...patch } : outcome)));
	}, []);

	const start = useCallback(
		(tests: ContextTest[], target: TestTarget, repeats: number) => {
			clearTimers();
			const schedule = scheduleRuns(tests, repeats);
			setOutcomes(schedule.map(({ test, runIndex }) => ({ testId: test.id, runIndex, status: 'pending' })));

			schedule.forEach((run, index) => {
				const passed = mockRunPasses(run.test, target, run.runIndex, repeats);
				const startTimer = setTimeout(() => updateOutcome(index, { status: 'running' }), run.startAtMs);
				const endTimer = setTimeout(
					() =>
						updateOutcome(index, {
							status: passed ? 'passed' : 'failed',
							durationSeconds: Math.round(run.durationMs / 25),
							failureReason: passed ? undefined : mockFailureReason(run.test.id, run.runIndex),
						}),
					run.startAtMs + run.durationMs,
				);
				timersRef.current.push(startTimer, endTimer);
			});
		},
		[clearTimers, updateOutcome],
	);

	const cancel = useCallback(() => {
		clearTimers();
		setOutcomes((current) =>
			current.filter((outcome) => outcome.status === 'passed' || outcome.status === 'failed'),
		);
	}, [clearTimers]);

	const completedCount = outcomes.filter(
		(outcome) => outcome.status === 'passed' || outcome.status === 'failed',
	).length;
	const isRunning = completedCount < outcomes.length;

	return { outcomes, start, cancel, isRunning, completedCount, totalCount: outcomes.length };
}

function scheduleRuns(tests: ContextTest[], repeats: number): ScheduledRun[] {
	const laneFreeAtMs = Array.from({ length: PARALLEL_RUNS }, () => 0);
	const runs = tests.flatMap((test) => Array.from({ length: repeats }, (_, runIndex) => ({ test, runIndex })));

	return runs.map(({ test, runIndex }) => {
		const lane = laneFreeAtMs.indexOf(Math.min(...laneFreeAtMs));
		const startAtMs = laneFreeAtMs[lane];
		const durationMs = mockRunDurationMs(test.id, runIndex);
		laneFreeAtMs[lane] += durationMs;
		return { test, runIndex, startAtMs, durationMs };
	});
}
