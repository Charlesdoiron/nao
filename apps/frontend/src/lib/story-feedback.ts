export type StoryFeedbackValue = 'up' | 'down';

export type StoryFeedbackVisibility = 'pinned' | 'project' | 'group';

export type StoryFeedbackScope = 'mine' | 'all';

export type StoryFeedbackFilter = 'all' | 'attention';

export type StoryFeedbackSortField = 'title' | 'owner' | 'positive' | 'negative' | 'approval' | 'lastFeedback';

export interface StoryFeedbackSort {
	field: StoryFeedbackSortField;
	direction: 'asc' | 'desc';
}

export interface StoryFeedbackVote {
	voterName: string;
	value: StoryFeedbackValue;
	createdAt: Date;
}

export interface StoryFeedbackEntry {
	storyId: string;
	title: string;
	ownerName: string;
	isOwnedByCurrentUser: boolean;
	visibility: StoryFeedbackVisibility;
	votes: StoryFeedbackVote[];
}

export interface StoryFeedbackRow extends StoryFeedbackEntry {
	positiveCount: number;
	negativeCount: number;
	approvalRate: number | null;
	lastFeedbackAt: Date | null;
	needsAttention: boolean;
}

export interface StoryFeedbackSummary {
	totalVotes: number;
	positiveCount: number;
	negativeCount: number;
	approvalRate: number | null;
	storiesNeedingAttention: number;
}

export const STORY_FEEDBACK_VISIBILITY_LABELS: Record<StoryFeedbackVisibility, string> = {
	pinned: 'Pinned for everyone',
	project: 'Shared with project',
	group: 'Shared with a group',
};

const ATTENTION_MIN_VOTES = 3;
const ATTENTION_MAX_APPROVAL = 0.5;

export function buildStoryFeedbackRows(entries: StoryFeedbackEntry[]): StoryFeedbackRow[] {
	return entries.map(toStoryFeedbackRow);
}

export function selectStoryFeedbackRows(
	rows: StoryFeedbackRow[],
	{ scope, query, filter }: { scope: StoryFeedbackScope; query: string; filter: StoryFeedbackFilter },
): StoryFeedbackRow[] {
	const normalizedQuery = query.trim().toLowerCase();
	return rows.filter(
		(row) =>
			(scope === 'all' || row.isOwnedByCurrentUser) &&
			(filter === 'all' || row.needsAttention) &&
			matchesQuery(row, normalizedQuery),
	);
}

export function sortStoryFeedbackRows(rows: StoryFeedbackRow[], sort: StoryFeedbackSort): StoryFeedbackRow[] {
	const multiplier = sort.direction === 'asc' ? 1 : -1;
	return [...rows].sort((a, b) => compareRows(a, b, sort.field) * multiplier);
}

export function summarizeStoryFeedback(rows: StoryFeedbackRow[]): StoryFeedbackSummary {
	const positiveCount = sum(rows.map((row) => row.positiveCount));
	const negativeCount = sum(rows.map((row) => row.negativeCount));
	const totalVotes = positiveCount + negativeCount;
	return {
		totalVotes,
		positiveCount,
		negativeCount,
		approvalRate: totalVotes > 0 ? positiveCount / totalVotes : null,
		storiesNeedingAttention: rows.filter((row) => row.needsAttention).length,
	};
}

export function formatApprovalRate(approvalRate: number | null): string {
	return approvalRate === null ? '—' : `${Math.round(approvalRate * 100)}%`;
}

function toStoryFeedbackRow(entry: StoryFeedbackEntry): StoryFeedbackRow {
	const positiveCount = entry.votes.filter((vote) => vote.value === 'up').length;
	const negativeCount = entry.votes.length - positiveCount;
	const approvalRate = entry.votes.length > 0 ? positiveCount / entry.votes.length : null;
	const sortedVotes = [...entry.votes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
	return {
		...entry,
		votes: sortedVotes,
		positiveCount,
		negativeCount,
		approvalRate,
		lastFeedbackAt: sortedVotes[0]?.createdAt ?? null,
		needsAttention:
			entry.votes.length >= ATTENTION_MIN_VOTES && approvalRate !== null && approvalRate < ATTENTION_MAX_APPROVAL,
	};
}

function matchesQuery(row: StoryFeedbackRow, normalizedQuery: string): boolean {
	if (!normalizedQuery) {
		return true;
	}
	return (
		row.title.toLowerCase().includes(normalizedQuery) ||
		row.ownerName.toLowerCase().includes(normalizedQuery) ||
		row.storyId === normalizedQuery
	);
}

function compareRows(a: StoryFeedbackRow, b: StoryFeedbackRow, field: StoryFeedbackSortField): number {
	switch (field) {
		case 'title':
			return a.title.localeCompare(b.title);
		case 'owner':
			return a.ownerName.localeCompare(b.ownerName);
		case 'positive':
			return a.positiveCount - b.positiveCount;
		case 'negative':
			return a.negativeCount - b.negativeCount;
		case 'approval':
			return (a.approvalRate ?? -1) - (b.approvalRate ?? -1);
		case 'lastFeedback':
			return (a.lastFeedbackAt?.getTime() ?? 0) - (b.lastFeedbackAt?.getTime() ?? 0);
	}
}

function sum(values: number[]): number {
	return values.reduce((total, value) => total + value, 0);
}
