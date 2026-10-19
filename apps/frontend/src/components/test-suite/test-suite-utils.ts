import type { GitRef, SuiteTest, TargetResult, TestFilters, TestStatus } from './test-suite-types';

export const STATUS_LABELS: Record<TestStatus, string> = {
	regressed: 'Regressed',
	improved: 'Improved',
	flaky: 'Flaky',
	failing: 'Failing',
	passing: 'Passing',
	'not-run': 'Not run',
};

export const EMPTY_FILTERS: TestFilters = {
	search: '',
	tags: [],
	owners: [],
	status: 'all',
	onlyLikelyAffected: false,
};

export function getPassRate(result: TargetResult | undefined): number | null {
	if (!result || result.runs.length === 0) {
		return null;
	}
	return result.runs.filter((run) => run.outcome === 'pass').length / result.runs.length;
}

export function getTestStatus(test: SuiteTest, baselineRefId: string, candidateRefId: string): TestStatus {
	const candidateRate = getPassRate(test.results[candidateRefId]);
	if (candidateRate === null) {
		return 'not-run';
	}
	const baselineRate = baselineRefId === candidateRefId ? null : getPassRate(test.results[baselineRefId]);
	if (baselineRate !== null && candidateRate < baselineRate) {
		return 'regressed';
	}
	if (baselineRate !== null && candidateRate > baselineRate) {
		return 'improved';
	}
	if (candidateRate === 1) {
		return 'passing';
	}
	if (candidateRate === 0) {
		return 'failing';
	}
	return 'flaky';
}

export function getRateDelta(test: SuiteTest, baselineRefId: string, candidateRefId: string): number | null {
	const baselineRate = getPassRate(test.results[baselineRefId]);
	const candidateRate = getPassRate(test.results[candidateRefId]);
	if (baselineRate === null || candidateRate === null || baselineRefId === candidateRefId) {
		return null;
	}
	return Math.round((candidateRate - baselineRate) * 100);
}

export function getSuiteRate(tests: SuiteTest[], refId: string): number | null {
	const runs = tests.flatMap((test) => test.results[refId]?.runs ?? []);
	if (runs.length === 0) {
		return null;
	}
	return runs.filter((run) => run.outcome === 'pass').length / runs.length;
}

export function isLikelyAffected(test: SuiteTest, ref: GitRef | undefined): boolean {
	if (!ref) {
		return false;
	}
	return test.addedOnRef === ref.id || ref.affectedPrefixes.some((prefix) => test.name.startsWith(prefix));
}

export function applyTestFilters(
	tests: SuiteTest[],
	filters: TestFilters,
	statusOf: (test: SuiteTest) => TestStatus,
	candidateRef: GitRef | undefined,
): SuiteTest[] {
	const search = filters.search.trim().toLowerCase();
	return tests.filter((test) => {
		if (search && !test.name.toLowerCase().includes(search) && !test.prompt.toLowerCase().includes(search)) {
			return false;
		}
		if (filters.tags.length > 0 && !filters.tags.some((tag) => test.tags.includes(tag))) {
			return false;
		}
		if (filters.owners.length > 0 && !filters.owners.includes(test.owner)) {
			return false;
		}
		if (filters.status !== 'all' && statusOf(test) !== filters.status) {
			return false;
		}
		if (filters.onlyLikelyAffected && !isLikelyAffected(test, candidateRef)) {
			return false;
		}
		return true;
	});
}

export function hasActiveFilters(filters: TestFilters): boolean {
	return (
		filters.search.trim() !== '' ||
		filters.tags.length > 0 ||
		filters.owners.length > 0 ||
		filters.status !== 'all' ||
		filters.onlyLikelyAffected
	);
}

export function collectTags(tests: SuiteTest[]): Map<string, number> {
	const counts = new Map<string, number>();
	tests.forEach((test) => test.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
	return new Map([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function inferTagsFromName(name: string): string[] {
	const prefix = name.split('/')[0];
	return prefix && prefix !== name ? [prefix] : [];
}

export function formatPercent(rate: number | null): string {
	return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

export function toTestFilePath(name: string): string {
	return `tests/${name}.yml`;
}
