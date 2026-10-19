import { useCallback, useEffect, useRef, useState } from 'react';

import { FAILURE_REASONS, getMockPassProbability, INITIAL_TESTS } from './test-suite-mock-data';
import type { SuiteTest, TestDraft, TestRun } from './test-suite-types';

export interface TestSuiteState {
	tests: SuiteTest[];
	isRunning: (testId: string, refId: string) => boolean;
	runningCount: number;
	runTests: (testIds: string[], refIds: string[], runsPerTest: number) => void;
	saveTest: (draft: TestDraft, options: { existingId?: string; refId: string }) => string;
	deleteTests: (testIds: string[]) => void;
	addTag: (testIds: string[], tag: string) => void;
	removeTag: (testId: string, tag: string) => void;
}

export function useTestSuite(): TestSuiteState {
	const [tests, setTests] = useState<SuiteTest[]>(INITIAL_TESTS);
	const [running, setRunning] = useState<Set<string>>(() => new Set());
	const timers = useRef<number[]>([]);

	useEffect(() => {
		const pending = timers.current;
		return () => pending.forEach((timer) => window.clearTimeout(timer));
	}, []);

	const isRunning = useCallback((testId: string, refId: string) => running.has(runKey(testId, refId)), [running]);

	const runTests = useCallback(
		(testIds: string[], refIds: string[], runsPerTest: number) => {
			const keys = testIds.flatMap((testId) => refIds.map((refId) => runKey(testId, refId)));
			setRunning((current) => new Set([...current, ...keys]));

			keys.forEach((key, index) => {
				const timer = window.setTimeout(
					() => completeRun(key, runsPerTest),
					900 + index * 260 + Math.random() * 600,
				);
				timers.current.push(timer);
			});

			function completeRun(key: string, runCount: number) {
				const [testId, refId] = splitRunKey(key);
				setTests((current) =>
					current.map((test) => {
						if (test.id !== testId) {
							return test;
						}
						const probability = getMockPassProbability(test, refId);
						return {
							...test,
							results: {
								...test.results,
								[refId]: { ranAt: Date.now(), runs: simulateRuns(probability, runCount) },
							},
						};
					}),
				);
				setRunning((current) => {
					const next = new Set(current);
					next.delete(key);
					return next;
				});
			}
		},
		[setTests],
	);

	const saveTest = useCallback((draft: TestDraft, options: { existingId?: string; refId: string }) => {
		const id = options.existingId ?? draft.name;
		setTests((current) => {
			if (options.existingId) {
				return current.map((test) =>
					test.id === options.existingId ? { ...test, ...draft, updatedAt: Date.now() } : test,
				);
			}
			const created: SuiteTest = {
				...draft,
				id,
				database: 'snowflake',
				updatedAt: Date.now(),
				addedOnRef: options.refId,
				results: {},
			};
			return [created, ...current];
		});
		return id;
	}, []);

	const deleteTests = useCallback((testIds: string[]) => {
		setTests((current) => current.filter((test) => !testIds.includes(test.id)));
	}, []);

	const addTag = useCallback((testIds: string[], tag: string) => {
		setTests((current) =>
			current.map((test) =>
				testIds.includes(test.id) && !test.tags.includes(tag) ? { ...test, tags: [...test.tags, tag] } : test,
			),
		);
	}, []);

	const removeTag = useCallback((testId: string, tag: string) => {
		setTests((current) =>
			current.map((test) => (test.id === testId ? { ...test, tags: test.tags.filter((t) => t !== tag) } : test)),
		);
	}, []);

	return {
		tests,
		isRunning,
		runningCount: running.size,
		runTests,
		saveTest,
		deleteTests,
		addTag,
		removeTag,
	};
}

function simulateRuns(passProbability: number, runCount: number): TestRun[] {
	return Array.from({ length: runCount }, () => {
		const passed = Math.random() < passProbability;
		return {
			outcome: passed ? 'pass' : 'fail',
			durationSeconds: Math.round(6 + Math.random() * 30),
			reason: passed ? undefined : FAILURE_REASONS[Math.floor(Math.random() * FAILURE_REASONS.length)],
		};
	});
}

function runKey(testId: string, refId: string): string {
	return `${testId}::${refId}`;
}

function splitRunKey(key: string): [string, string] {
	const [testId, refId] = key.split('::');
	return [testId, refId];
}
