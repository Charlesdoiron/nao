import { useCallback, useEffect, useRef, useState } from 'react';
import type { StoryFilterSelections } from '@nao/shared/sql-template';
import type { FilterTestInput, FilterTestResult } from '@/lib/sql-filter-test-run';

import { runFilterTest } from '@/lib/sql-filter-test-run';

const SIMULATED_LATENCY_MS = 450;

export const FULL_QUERY_RUN_KEY = '__full_query__';

export type FilterTestRun = { status: 'running' } | { status: 'done'; result: FilterTestResult };

/** Keyed test runs (one per filter, plus the full query) of the filter templates with test values. */
export function useFilterTestRuns(input: Omit<FilterTestInput, 'selections'>) {
	const [runs, setRuns] = useState<Record<string, FilterTestRun>>({});
	const inputRef = useRef(input);
	inputRef.current = input;
	const timersRef = useRef(new Map<string, number>());

	useEffect(() => {
		const timers = timersRef.current;
		return () => timers.forEach((timer) => window.clearTimeout(timer));
	}, []);

	const run = useCallback((key: string, selections: StoryFilterSelections) => {
		window.clearTimeout(timersRef.current.get(key));
		setRuns((previous) => ({ ...previous, [key]: { status: 'running' } }));
		const timer = window.setTimeout(() => {
			const result = runFilterTest({ ...inputRef.current, selections });
			setRuns((previous) => ({ ...previous, [key]: { status: 'done', result } }));
			timersRef.current.delete(key);
		}, SIMULATED_LATENCY_MS);
		timersRef.current.set(key, timer);
	}, []);

	const reset = useCallback(() => {
		timersRef.current.forEach((timer) => window.clearTimeout(timer));
		timersRef.current.clear();
		setRuns({});
	}, []);

	return { runs, run, reset };
}
