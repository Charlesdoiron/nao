import { SelectorStore } from './abstract-store';
import type { StoryFeedbackValue } from '@/lib/story-feedback';
import { createLocalStorage } from '@/lib/local-storage';

type StoryFeedbackVotes = Record<string, StoryFeedbackValue>;

const storage = createLocalStorage<StoryFeedbackVotes>('nao:story-feedback-votes', {});

class StoryFeedbackStore extends SelectorStore<StoryFeedbackVotes> {
	protected state: StoryFeedbackVotes = storage.get();

	toggle = (storyId: string, value: StoryFeedbackValue) => {
		const { [storyId]: previous, ...rest } = this.state;
		this.state = previous === value ? rest : { ...rest, [storyId]: value };
		storage.set(this.state);
		this.notify(storyId);
	};

	getVote = (storyId: string): StoryFeedbackValue | null => this.state[storyId] ?? null;
}

export const storyFeedbackStore = new StoryFeedbackStore();
