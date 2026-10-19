export type RunOutcome = 'pass' | 'fail';

export type TestStatus = 'regressed' | 'improved' | 'flaky' | 'failing' | 'passing' | 'not-run';

export interface TestRun {
	outcome: RunOutcome;
	durationSeconds: number;
	reason?: string;
}

export interface TargetResult {
	runs: TestRun[];
	ranAt: number;
}

export interface SuiteTest {
	id: string;
	name: string;
	prompt: string;
	sql: string;
	database: string;
	tags: string[];
	owner: string;
	updatedAt: number;
	addedOnRef?: string;
	results: Record<string, TargetResult | undefined>;
}

export interface GitRef {
	id: string;
	kind: 'branch' | 'tag';
	name: string;
	isProduction?: boolean;
	commit: string;
	pushedBy: string[];
	updatedAt: number;
	commitsAhead: number;
	changedContextFiles: string[];
	affectedPrefixes: string[];
}

export interface TestDraft {
	name: string;
	prompt: string;
	sql: string;
	tags: string[];
	owner: string;
}

export interface TestFilters {
	search: string;
	tags: string[];
	owners: string[];
	status: TestStatus | 'all';
	onlyLikelyAffected: boolean;
}
