import type {
	StoryFeedbackEntry,
	StoryFeedbackValue,
	StoryFeedbackVisibility,
	StoryFeedbackVote,
} from './story-feedback';

interface MockStory {
	storyId: string;
	title: string;
	ownerName: string | null;
	visibility: StoryFeedbackVisibility;
	positive: number;
	negative: number;
	latestHoursAgo: number;
}

const VOTER_NAMES = [
	'Camille Laurent',
	'Hugo Martin',
	'Inès Moreau',
	'Lucas Bernard',
	'Sarah Cohen',
	'Tom Dubois',
	'Léa Petit',
	'Noah Garcia',
	'Emma Rossi',
	'Jules Lefèvre',
	'Chloé Durand',
	'Adam Nguyen',
];

const MOCK_STORIES: MockStory[] = [
	{
		storyId: 'weekly-revenue',
		title: 'Weekly revenue review',
		ownerName: null,
		visibility: 'pinned',
		positive: 18,
		negative: 2,
		latestHoursAgo: 3,
	},
	{
		storyId: 'churn-drivers',
		title: 'Churn drivers Q3',
		ownerName: null,
		visibility: 'project',
		positive: 4,
		negative: 7,
		latestHoursAgo: 20,
	},
	{
		storyId: 'activation-funnel',
		title: 'Activation funnel deep dive',
		ownerName: null,
		visibility: 'group',
		positive: 6,
		negative: 1,
		latestHoursAgo: 52,
	},
	{
		storyId: 'marketing-attribution',
		title: 'Marketing attribution by channel',
		ownerName: 'Camille Laurent',
		visibility: 'pinned',
		positive: 25,
		negative: 4,
		latestHoursAgo: 1,
	},
	{
		storyId: 'support-sla',
		title: 'Support SLA breaches',
		ownerName: 'Hugo Martin',
		visibility: 'project',
		positive: 2,
		negative: 9,
		latestHoursAgo: 6,
	},
	{
		storyId: 'inventory-forecast',
		title: 'Inventory forecast — EU warehouses',
		ownerName: 'Inès Moreau',
		visibility: 'group',
		positive: 11,
		negative: 3,
		latestHoursAgo: 30,
	},
	{
		storyId: 'nps-trends',
		title: 'NPS trends by segment',
		ownerName: 'Lucas Bernard',
		visibility: 'pinned',
		positive: 9,
		negative: 0,
		latestHoursAgo: 75,
	},
	{
		storyId: 'sales-pipeline',
		title: 'Sales pipeline health',
		ownerName: 'Sarah Cohen',
		visibility: 'project',
		positive: 3,
		negative: 4,
		latestHoursAgo: 12,
	},
	{
		storyId: 'cohort-retention',
		title: 'Cohort retention 2026',
		ownerName: 'Tom Dubois',
		visibility: 'project',
		positive: 7,
		negative: 2,
		latestHoursAgo: 140,
	},
	{
		storyId: 'board-kpis',
		title: 'Board KPIs — monthly pack',
		ownerName: 'Camille Laurent',
		visibility: 'pinned',
		positive: 14,
		negative: 1,
		latestHoursAgo: 9,
	},
	{
		storyId: 'pricing-experiment',
		title: 'Pricing experiment readout',
		ownerName: 'Léa Petit',
		visibility: 'group',
		positive: 1,
		negative: 3,
		latestHoursAgo: 220,
	},
	{
		storyId: 'data-freshness',
		title: 'Data freshness monitor',
		ownerName: 'Noah Garcia',
		visibility: 'project',
		positive: 0,
		negative: 0,
		latestHoursAgo: 0,
	},
];

export function getMockStoryFeedbackEntries(currentUserName: string): StoryFeedbackEntry[] {
	return MOCK_STORIES.map((story, storyIndex) => ({
		storyId: story.storyId,
		title: story.title,
		ownerName: story.ownerName ?? currentUserName,
		isOwnedByCurrentUser: story.ownerName === null,
		visibility: story.visibility,
		votes: buildMockVotes(story, storyIndex),
	}));
}

export function getMockStoryFeedbackTotals(storyId: string, title: string): { positive: number; negative: number } {
	const mockStory = MOCK_STORIES.find((story) => story.title === title);
	if (mockStory) {
		return { positive: mockStory.positive, negative: mockStory.negative };
	}
	const hash = [...storyId].reduce((total, char) => total + char.charCodeAt(0), 0);
	return { positive: 4 + (hash % 13), negative: hash % 5 };
}

function buildMockVotes(story: MockStory, storyIndex: number): StoryFeedbackVote[] {
	const voterNames = VOTER_NAMES.filter((name) => name !== story.ownerName);
	const values: StoryFeedbackValue[] = [
		...Array<StoryFeedbackValue>(story.positive).fill('up'),
		...Array<StoryFeedbackValue>(story.negative).fill('down'),
	];
	return interleave(values).map((value, voteIndex) => ({
		voterName: voterNames[(storyIndex * 5 + voteIndex) % voterNames.length],
		value,
		createdAt: hoursAgo(story.latestHoursAgo + voteIndex * (7 + (storyIndex % 4) * 5)),
	}));
}

function interleave(values: StoryFeedbackValue[]): StoryFeedbackValue[] {
	const ups = values.filter((value) => value === 'up');
	const downs = values.filter((value) => value === 'down');
	const result: StoryFeedbackValue[] = [];
	while (ups.length || downs.length) {
		if (downs.length) {
			result.push(downs.shift()!);
		}
		result.push(...ups.splice(0, 2));
	}
	return result;
}

function hoursAgo(hours: number): Date {
	return new Date(Date.now() - hours * 60 * 60 * 1000);
}
