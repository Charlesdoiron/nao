import { MOCK_TABLE_JOINS } from '@/lib/context-tests-mock';

export interface TestOwner {
	id: string;
	name: string;
	email: string;
}

export interface ContextRef {
	id: string;
	label: string;
	kind: 'branch' | 'tag';
	commit: string;
	ownerId?: string;
	isProduction?: boolean;
}

export interface TestRunSummary {
	passes: number;
	runs: number;
	ref: string;
	ranAt: string;
}

export interface ContextTest {
	id: string;
	name: string;
	prompt: string;
	sql: string;
	tags: string[];
	ownerId: string;
	branch: string;
	tables: string[];
	baseline: TestRunSummary | null;
}

export type TestRunStatus = 'queued' | 'running' | 'done';

export interface TestRun {
	status: TestRunStatus;
	results: boolean[];
	runs: number;
	ref: string;
	ranAt: string | null;
}

export type TestRelevanceLevel = 'direct' | 'likely';

export interface TestRelevance {
	test: ContextTest;
	level: TestRelevanceLevel;
	reason: string;
}

export interface TestFilter {
	namePrefix: string;
	tags: string[];
	ownerIds: string[];
}

export const RUNS_PER_TEST_OPTIONS = [1, 3, 5] as const;

const ESTIMATED_COST_PER_RUN_USD = 0.03;
const GLOBAL_CONTEXT_FILES = ['RULES.md', 'nao_config.yaml'];
const TEST_NAME_STOP_WORDS = [
	'a',
	'by',
	'did',
	'do',
	'does',
	'for',
	'how',
	'in',
	'is',
	'last',
	'many',
	'me',
	'much',
	'of',
	'our',
	'show',
	'the',
	'to',
	'was',
	'we',
	'were',
	'what',
];

export function findRelevantTests(tests: ContextTest[], filePath: string): TestRelevance[] {
	const fileName = filePath.split('/').pop() ?? filePath;
	if (GLOBAL_CONTEXT_FILES.includes(fileName)) {
		return tests.map((test) => ({
			test,
			level: 'likely',
			reason: 'Loaded for every question',
		}));
	}

	const table = getTableFromContextPath(filePath);
	if (!table) {
		return findTestsByKeyword(tests, fileName);
	}

	const joinedTables = MOCK_TABLE_JOINS[table] ?? [];
	return tests.flatMap<TestRelevance>((test) => {
		if (test.tables.includes(table)) {
			return [{ test, level: 'direct', reason: `Expected SQL reads ${table}` }];
		}
		const joinedTable = test.tables.find((testTable) => joinedTables.includes(testTable));
		if (joinedTable) {
			return [{ test, level: 'likely', reason: `Agent may join ${joinedTable} with ${table}` }];
		}
		return [];
	});
}

export function getTableFromContextPath(filePath: string): string | null {
	const match = filePath.match(/table=([^/]+)/);
	return match?.[1] ?? null;
}

export function getContextFileLabel(filePath: string): string {
	const table = getTableFromContextPath(filePath);
	const fileName = filePath.split('/').pop() ?? filePath;
	return table ? `${table} / ${fileName}` : fileName;
}

export function filterTests(tests: ContextTest[], filter: TestFilter): ContextTest[] {
	const prefix = filter.namePrefix.trim().toLowerCase();
	return tests.filter(
		(test) =>
			(!prefix || test.name.toLowerCase().startsWith(prefix)) &&
			(filter.tags.length === 0 || filter.tags.every((tag) => test.tags.includes(tag))) &&
			(filter.ownerIds.length === 0 || filter.ownerIds.includes(test.ownerId)),
	);
}

export function getPassRate(passes: number, runs: number): number | null {
	return runs === 0 ? null : passes / runs;
}

export function getRunPassRate(run: TestRun | undefined): number | null {
	if (!run || run.status !== 'done') {
		return null;
	}
	return getPassRate(countPasses(run.results), run.results.length);
}

export function getBaselinePassRate(test: ContextTest): number | null {
	return test.baseline ? getPassRate(test.baseline.passes, test.baseline.runs) : null;
}

export function getAveragePassRate(rates: (number | null)[]): number | null {
	const knownRates = rates.filter((rate): rate is number => rate !== null);
	if (knownRates.length === 0) {
		return null;
	}
	return knownRates.reduce((sum, rate) => sum + rate, 0) / knownRates.length;
}

export function countPasses(results: boolean[]): number {
	return results.filter(Boolean).length;
}

export function formatPassRate(rate: number | null): string {
	return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

export function formatRunCost(testCount: number, runsPerTest: number): string {
	const cost = testCount * runsPerTest * ESTIMATED_COST_PER_RUN_USD;
	return `~$${cost.toFixed(2)}`;
}

export function buildRunResults(passRate: number, runs: number, seed: string): boolean[] {
	const passes = Math.round(passRate * runs);
	const order = Array.from({ length: runs }, (_, index) => index).sort(
		(left, right) => seededValue(`${seed}:${left}`) - seededValue(`${seed}:${right}`),
	);
	const passingIndexes = new Set(order.slice(0, passes));
	return Array.from({ length: runs }, (_, index) => passingIndexes.has(index));
}

export function suggestTags(sql: string, prompt: string): string[] {
	const tables = [...sql.matchAll(/\b(?:from|join)\s+([a-z_][a-z0-9_]*)/gi)].map((match) => match[1].toLowerCase());
	const keywords = ['revenue', 'refunds', 'customers', 'payments', 'orders'].filter((keyword) =>
		prompt.toLowerCase().includes(keyword.replace(/s$/, '')),
	);
	return [...new Set([...tables, ...keywords])];
}

export function toTestName(prompt: string): string {
	return prompt
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, '')
		.trim()
		.split(/\s+/)
		.filter((word) => !TEST_NAME_STOP_WORDS.includes(word))
		.slice(0, 4)
		.join('_');
}

export function formatRelativeTime(isoDate: string | null): string {
	if (!isoDate) {
		return 'Never run';
	}
	const minutes = Math.round((Date.now() - new Date(isoDate).getTime()) / 60_000);
	if (minutes < 1) {
		return 'Just now';
	}
	if (minutes < 60) {
		return `${minutes}m ago`;
	}
	const hours = Math.round(minutes / 60);
	if (hours < 24) {
		return `${hours}h ago`;
	}
	return `${Math.round(hours / 24)}d ago`;
}

function findTestsByKeyword(tests: ContextTest[], fileName: string): TestRelevance[] {
	const words = fileName
		.replace(/\.[^.]+$/, '')
		.toLowerCase()
		.split(/[^a-z]+/)
		.filter((word) => word.length > 3);
	return tests.flatMap<TestRelevance>((test) => {
		const matchedWord = words.find(
			(word) => test.prompt.toLowerCase().includes(word) || test.tags.some((tag) => tag.includes(word)),
		);
		return matchedWord ? [{ test, level: 'likely', reason: `Question mentions “${matchedWord}”` }] : [];
	});
}

function seededValue(seed: string): number {
	let hash = 0;
	for (const character of seed) {
		hash = (hash * 31 + character.charCodeAt(0)) | 0;
	}
	return Math.abs(hash % 1000) / 1000;
}
