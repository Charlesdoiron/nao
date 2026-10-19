import { Store } from './abstract-store';

export type StoryFeedbackVote = 'up' | 'down';

export interface StoryFeedbackEntry {
	id: string;
	storyId: string;
	authorName: string;
	vote: StoryFeedbackVote;
	comment?: string;
	versionNumber: number;
	createdAt: Date;
	isMine?: boolean;
	isInRecommendations?: boolean;
}

export interface StoryFeedbackStorySummary {
	storyId: string;
	title: string;
	ownerName: string;
	isPinned: boolean;
	entries: StoryFeedbackEntry[];
}

interface MyFeedback {
	vote: StoryFeedbackVote;
	comment?: string;
	createdAt: Date;
}

type StoryFeedbackState = Record<string, MyFeedback | undefined>;

class StoryFeedbackStore extends Store<StoryFeedbackState> {
	protected state: StoryFeedbackState = {};

	vote = (storyId: string, vote: StoryFeedbackVote) => {
		const current = this.state[storyId];
		const next = current?.vote === vote ? undefined : { vote, createdAt: new Date() };
		this.state = { ...this.state, [storyId]: next };
		this.notify();
	};

	comment = (storyId: string, comment: string) => {
		const current = this.state[storyId];
		if (!current) {
			return;
		}
		this.state = { ...this.state, [storyId]: { ...current, comment } };
		this.notify();
	};

	getSnapshot = () => this.state;
}

export const storyFeedbackStore = new StoryFeedbackStore();

export function buildStoryEntries(storyId: string, mine: MyFeedback | undefined, myName: string): StoryFeedbackEntry[] {
	const mockEntries = MOCK_STORY_FEEDBACK.map((entry, index) => ({
		...entry,
		id: `${storyId}-${index}`,
		storyId,
		createdAt: hoursAgo(entry.hoursAgo),
	}));

	if (!mine) {
		return mockEntries;
	}

	const myEntry: StoryFeedbackEntry = {
		id: `${storyId}-mine`,
		storyId,
		authorName: myName,
		vote: mine.vote,
		comment: mine.comment,
		versionNumber: 3,
		createdAt: mine.createdAt,
		isMine: true,
	};
	return [myEntry, ...mockEntries];
}

export function buildOtherStorySummaries(): StoryFeedbackStorySummary[] {
	return MOCK_OTHER_STORIES.map((story) => ({
		storyId: story.storyId,
		title: story.title,
		ownerName: story.ownerName,
		isPinned: story.isPinned,
		entries: story.votes.map(([vote, authorName, hours, comment], index) => ({
			id: `${story.storyId}-${index}`,
			storyId: story.storyId,
			authorName,
			vote,
			comment,
			versionNumber: 1,
			createdAt: hoursAgo(hours),
			isInRecommendations: vote === 'down' && Boolean(comment),
		})),
	}));
}

function hoursAgo(hours: number): Date {
	return new Date(Date.now() - hours * 60 * 60 * 1000);
}

const MOCK_STORY_FEEDBACK: (Omit<StoryFeedbackEntry, 'id' | 'storyId' | 'createdAt'> & { hoursAgo: number })[] = [
	{
		authorName: 'Ada Lovelace',
		vote: 'down',
		comment: 'Last month looks too high — I think one of the large accounts is counted twice.',
		versionNumber: 3,
		hoursAgo: 2,
		isInRecommendations: true,
	},
	{
		authorName: 'Alan Turing',
		vote: 'up',
		comment: 'Exactly what I needed for the board deck, thanks!',
		versionNumber: 3,
		hoursAgo: 5,
	},
	{ authorName: 'Grace Hopper', vote: 'up', versionNumber: 3, hoursAgo: 9 },
	{
		authorName: 'Katherine Johnson',
		vote: 'up',
		comment: 'Clear and easy to share with my team.',
		versionNumber: 2,
		hoursAgo: 26,
	},
	{
		authorName: 'Linus Pauling',
		vote: 'down',
		comment: 'Should be split by region, the global number hides what is happening in EMEA.',
		versionNumber: 2,
		hoursAgo: 30,
		isInRecommendations: true,
	},
	{ authorName: 'Rosalind Franklin', vote: 'up', versionNumber: 2, hoursAgo: 52 },
	{ authorName: 'Niels Bohr', vote: 'up', versionNumber: 2, hoursAgo: 75 },
	{ authorName: 'Hedy Lamarr', vote: 'up', versionNumber: 1, hoursAgo: 120 },
	{ authorName: 'Carl Sagan', vote: 'down', versionNumber: 1, hoursAgo: 150 },
];

const MOCK_OTHER_STORIES: {
	storyId: string;
	title: string;
	ownerName: string;
	isPinned: boolean;
	votes: [StoryFeedbackVote, string, number, string?][];
}[] = [
	{
		storyId: 'mock-pipeline',
		title: 'Sales pipeline by stage',
		ownerName: 'Alan Turing',
		isPinned: true,
		votes: [
			['down', 'Ada Lovelace', 3, 'The qualified stage seems to include closed-lost deals.'],
			['down', 'Grace Hopper', 8, 'Pipeline amount does not match Salesforce.'],
			['down', 'Niels Bohr', 20],
			['up', 'Hedy Lamarr', 40],
			['up', 'Carl Sagan', 60],
		],
	},
	{
		storyId: 'mock-nps',
		title: 'NPS by customer segment',
		ownerName: 'Grace Hopper',
		isPinned: false,
		votes: [
			['up', 'Ada Lovelace', 4, 'Love the verbatims section.'],
			['up', 'Alan Turing', 10],
			['up', 'Linus Pauling', 30],
			['down', 'Rosalind Franklin', 50, 'Which survey wave is this? Not stated anywhere.'],
		],
	},
	{
		storyId: 'mock-marketing',
		title: 'Marketing spend efficiency',
		ownerName: 'Hedy Lamarr',
		isPinned: true,
		votes: [
			['up', 'Katherine Johnson', 6],
			['up', 'Niels Bohr', 16],
			['up', 'Carl Sagan', 22],
		],
	},
];
