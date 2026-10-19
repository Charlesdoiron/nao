export type StoryFeedbackVote = 'up' | 'down';

export type StoryFeedbackEntry = {
	id: string;
	storyId: string;
	userName: string;
	vote: StoryFeedbackVote;
	reasons: string[];
	comment?: string;
	storyVersion: number;
	createdAt: Date;
	isNew: boolean;
	isMine?: boolean;
};

export type StoryFeedbackSummary = {
	up: number;
	down: number;
	total: number;
	newCount: number;
	commentCount: number;
	lastFeedbackAt: Date | null;
};

export type StoryFeedbackSentiment = 'all' | 'positive' | 'negative';
export type StoryFeedbackOwnerFilter = 'anyone' | 'mine';

export type StoryFeedbackFilters = {
	sentiment: StoryFeedbackSentiment;
	withComments: boolean;
	newOnly: boolean;
	owner: StoryFeedbackOwnerFilter;
};

export type StoryFeedbackStats = {
	storyCount: number;
	total: number;
	positiveRate: number | null;
	newCount: number;
	negativeStoryCount: number;
};

type FeedbackSubject = {
	kind: 'own' | 'own-standalone' | 'shared-with-me' | 'shared-project';
	isPinned: boolean;
	feedback?: StoryFeedbackSummary | null;
};

export const NEGATIVE_FEEDBACK_REASONS = [
	'Numbers look wrong',
	'Data is outdated',
	'Hard to understand',
	'Missing info',
];
export const POSITIVE_FEEDBACK_REASONS = ['Accurate', 'Clear and readable', 'Useful insights', 'Saves me time'];

export const DEFAULT_STORY_FEEDBACK_FILTERS: StoryFeedbackFilters = {
	sentiment: 'all',
	withComments: false,
	newOnly: false,
	owner: 'anyone',
};

export function summarizeStoryFeedback(entries: StoryFeedbackEntry[]): StoryFeedbackSummary {
	const up = entries.filter((entry) => entry.vote === 'up').length;
	const lastFeedbackAt = entries.reduce<Date | null>(
		(latest, entry) => (!latest || entry.createdAt > latest ? entry.createdAt : latest),
		null,
	);
	return {
		up,
		down: entries.length - up,
		total: entries.length,
		newCount: entries.filter((entry) => entry.isNew).length,
		commentCount: entries.filter((entry) => !!entry.comment).length,
		lastFeedbackAt,
	};
}

/**
 * Owners see feedback on their stories and everyone sees it on pinned or project-wide stories.
 * Admins see feedback on every story.
 */
export function canSeeStoryFeedback(item: FeedbackSubject, isAdmin: boolean): boolean {
	return isAdmin || item.kind === 'own' || item.kind === 'own-standalone' || item.kind === 'shared-project';
}

export function isOwnFeedbackSubject(item: FeedbackSubject): boolean {
	return item.kind === 'own' || item.kind === 'own-standalone';
}

export function hasFeedback(item: FeedbackSubject): boolean {
	return (item.feedback?.total ?? 0) > 0;
}

export function matchesFeedbackOwner(item: FeedbackSubject, owner: StoryFeedbackOwnerFilter): boolean {
	return owner === 'anyone' || isOwnFeedbackSubject(item);
}

export function matchesFeedbackFilters(item: FeedbackSubject, filters: StoryFeedbackFilters): boolean {
	const feedback = item.feedback;
	if (!feedback || feedback.total === 0 || !matchesFeedbackOwner(item, filters.owner)) {
		return false;
	}
	if (filters.sentiment === 'positive' && feedback.up === 0) {
		return false;
	}
	if (filters.sentiment === 'negative' && feedback.down === 0) {
		return false;
	}
	if (filters.withComments && feedback.commentCount === 0) {
		return false;
	}
	return !filters.newOnly || feedback.newCount > 0;
}

export function computeStoryFeedbackStats(items: FeedbackSubject[]): StoryFeedbackStats {
	const summaries = items.map((item) => item.feedback).filter((feedback) => !!feedback && feedback.total > 0);
	const total = summaries.reduce((sum, feedback) => sum + feedback!.total, 0);
	const up = summaries.reduce((sum, feedback) => sum + feedback!.up, 0);
	return {
		storyCount: summaries.length,
		total,
		positiveRate: total > 0 ? Math.round((up / total) * 100) : null,
		newCount: summaries.reduce((sum, feedback) => sum + feedback!.newCount, 0),
		negativeStoryCount: summaries.filter((feedback) => feedback!.down > 0).length,
	};
}

export function getFeedbackSortValue(feedback: StoryFeedbackSummary | null | undefined): number {
	if (!feedback) {
		return -1;
	}
	return feedback.down * 1000 + feedback.total;
}
