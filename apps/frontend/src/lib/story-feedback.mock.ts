import type { StoryFeedbackEntry, StoryFeedbackVote } from '@/lib/story-feedback';

type MockEntryInput = {
	userName: string;
	vote: StoryFeedbackVote;
	daysAgo: number;
	reasons?: string[];
	comment?: string;
	storyVersion?: number;
	isNew?: boolean;
	isMine?: boolean;
};

export type StoryFeedbackSubmission = {
	vote: StoryFeedbackVote;
	reasons: string[];
	comment?: string;
	userName: string;
};

const DAY_MS = 86_400_000;

const MOCK_FEEDBACK: Record<string, MockEntryInput[]> = {
	'story-weekly-revenue': [
		{
			userName: 'Alice Martin',
			vote: 'down',
			daysAgo: 0.2,
			reasons: ['Numbers look wrong'],
			comment: 'Enterprise revenue does not match the finance close (we report $468k).',
			storyVersion: 3,
			isNew: true,
		},
		{
			userName: 'Farid Haddad',
			vote: 'down',
			daysAgo: 0.6,
			reasons: ['Data is outdated'],
			comment: 'Still showing last week on Monday morning — refresh should run before 8am.',
			storyVersion: 3,
			isNew: true,
		},
		{ userName: 'Bruno Diaz', vote: 'up', daysAgo: 1, reasons: ['Useful insights'], storyVersion: 3 },
		{
			userName: 'Chloe Kim',
			vote: 'up',
			daysAgo: 2,
			reasons: ['Saves me time'],
			comment: 'I paste this into the Monday exec update every week.',
			storyVersion: 2,
		},
		{ userName: 'David Lee', vote: 'up', daysAgo: 3, reasons: ['Clear and readable'], storyVersion: 2 },
		{ userName: 'Emma Rossi', vote: 'up', daysAgo: 4, storyVersion: 2 },
		{ userName: 'Grace Wu', vote: 'down', daysAgo: 6, reasons: ['Missing info'], storyVersion: 1 },
		{ userName: 'Hugo Blanc', vote: 'up', daysAgo: 7, reasons: ['Accurate'], storyVersion: 1 },
		{ userName: 'Ines Costa', vote: 'up', daysAgo: 9, storyVersion: 1 },
	],
	'story-churn-q3': [
		{
			userName: 'Bruno Diaz',
			vote: 'down',
			daysAgo: 0.4,
			reasons: ['Numbers look wrong', 'Hard to understand'],
			comment: 'Churn definition here counts paused accounts. Finance excludes them.',
			storyVersion: 2,
			isNew: true,
		},
		{
			userName: 'Emma Rossi',
			vote: 'down',
			daysAgo: 1.5,
			reasons: ['Missing info'],
			comment: 'Would love a split by acquisition channel.',
			storyVersion: 2,
			isNew: true,
		},
		{ userName: 'Chloe Kim', vote: 'down', daysAgo: 2, reasons: ['Hard to understand'], storyVersion: 2 },
		{ userName: 'David Lee', vote: 'up', daysAgo: 3, reasons: ['Useful insights'], storyVersion: 1 },
		{ userName: 'Alice Martin', vote: 'up', daysAgo: 5, storyVersion: 1 },
	],
	'story-ops-dashboard': [
		{ userName: 'Bruno Diaz', vote: 'up', daysAgo: 0.3, reasons: ['Saves me time'], storyVersion: 4, isNew: true },
		{
			userName: 'Farid Haddad',
			vote: 'down',
			daysAgo: 1,
			reasons: ['Data is outdated'],
			comment: 'Warehouse B numbers lag by a day.',
			storyVersion: 4,
		},
		{ userName: 'Chloe Kim', vote: 'up', daysAgo: 2, reasons: ['Clear and readable'], storyVersion: 4 },
		{ userName: 'Grace Wu', vote: 'up', daysAgo: 4, storyVersion: 3 },
		{ userName: 'Hugo Blanc', vote: 'up', daysAgo: 5, storyVersion: 3 },
	],
	'story-product-adoption': [
		{
			userName: 'Alice Martin',
			vote: 'up',
			daysAgo: 1,
			reasons: ['Useful insights'],
			comment: 'The cohort chart is great for the roadmap review.',
			storyVersion: 1,
		},
		{ userName: 'Emma Rossi', vote: 'up', daysAgo: 2, storyVersion: 1 },
	],
	'story-sales-pipeline': [
		{
			userName: 'Test',
			vote: 'down',
			daysAgo: 0.5,
			reasons: ['Missing info'],
			comment: 'Add expected close date per stage.',
			storyVersion: 2,
			isNew: true,
			isMine: true,
		},
		{ userName: 'David Lee', vote: 'down', daysAgo: 2, reasons: ['Numbers look wrong'], storyVersion: 2 },
		{ userName: 'Ines Costa', vote: 'up', daysAgo: 6, storyVersion: 1 },
	],
	'story-support-tickets': [
		{
			userName: 'Chloe Kim',
			vote: 'down',
			daysAgo: 3,
			reasons: ['Hard to understand'],
			comment: 'Too many charts, unclear which KPI matters.',
			storyVersion: 1,
		},
	],
};

export type StoryFeedbackSnapshot = ReadonlyMap<string, StoryFeedbackEntry[]>;

const listeners = new Set<() => void>();
let snapshot: StoryFeedbackSnapshot = new Map(
	Object.entries(MOCK_FEEDBACK).map(([storyId, inputs]) => [
		storyId,
		inputs.map((input, index) => toEntry(storyId, input, index)),
	]),
);

export function subscribeToStoryFeedback(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function getStoryFeedbackSnapshot(): StoryFeedbackSnapshot {
	return snapshot;
}

export function getStoryFeedbackEntries(feedback: StoryFeedbackSnapshot, storyId: string): StoryFeedbackEntry[] {
	return feedback.get(storyId) ?? [];
}

export function submitStoryFeedback(storyId: string, submission: StoryFeedbackSubmission): void {
	const others = getStoryFeedbackEntries(snapshot, storyId).filter((entry) => !entry.isMine);
	const mine: StoryFeedbackEntry = {
		id: `${storyId}-mine-${Date.now()}`,
		storyId,
		userName: submission.userName,
		vote: submission.vote,
		reasons: submission.reasons,
		comment: submission.comment,
		storyVersion: Math.max(1, ...others.map((entry) => entry.storyVersion)),
		createdAt: new Date(),
		isNew: true,
		isMine: true,
	};
	setStoryEntries(storyId, [mine, ...others]);
}

export function markStoryFeedbackReviewed(storyId: string): void {
	const entries = getStoryFeedbackEntries(snapshot, storyId).map((entry) => ({ ...entry, isNew: false }));
	setStoryEntries(storyId, entries);
}

function toEntry(storyId: string, input: MockEntryInput, index: number): StoryFeedbackEntry {
	return {
		id: `${storyId}-${index}`,
		storyId,
		userName: input.userName,
		vote: input.vote,
		reasons: input.reasons ?? [],
		comment: input.comment,
		storyVersion: input.storyVersion ?? 1,
		createdAt: new Date(Date.now() - input.daysAgo * DAY_MS),
		isNew: input.isNew ?? false,
		isMine: input.isMine,
	};
}

function setStoryEntries(storyId: string, entries: StoryFeedbackEntry[]): void {
	snapshot = new Map(snapshot).set(storyId, entries);
	for (const listener of listeners) {
		listener();
	}
}
