import { createContext, useCallback, useContext, useMemo } from 'react';
import { buildStoryChartBlock } from '@nao/shared';
import { getStoryFiltersFromCode } from '@nao/shared/story-segments';
import { useStoryBlockEdit } from './use-story-block-edit';
import type { ParsedFilterBlock } from '@nao/shared/story-segments';
import type { displayChart } from '@nao/shared/tools';
import type { StoryFilterApi } from '@/hooks/use-story-filters';
import { dedupeFilters } from '@/hooks/use-story-filters';

type EditableChartInput = displayChart.ChartInput | displayChart.KpiCardInput;

export interface StoryChartEditHandlers {
	/**
	 * Persists a new chart config by replacing `rawTag` (the original `<chart ... />` tag)
	 * in the story's markdown and saving a new version.
	 * Returns a promise that rejects if the save fails.
	 */
	saveChart: (rawTag: string, config: EditableChartInput) => Promise<void>;
	/** Whether a save is currently in flight. */
	isSaving: boolean;
	/** Human-readable hint describing how the edit is persisted, shown in the edit dialog. */
	saveDescription: string;
	/** The saved story being edited, used to load chart SQL when the chat is not loaded. */
	story?: { chatId: string; storySlug: string };
	/** The `<filter />` tags declared in the story, so the SQL editor can lint and test filter templates. */
	filters?: ParsedFilterBlock[];
	filterApi?: StoryFilterApi;
}

const VERSION_SAVE_DESCRIPTION = 'Tweak the chart parameters. Changes are saved to the story as a new version.';
const EDITOR_SAVE_DESCRIPTION =
	'Tweak the chart parameters. Changes apply to the story you are editing and are saved when you save the story.';

const StoryChartEditContext = createContext<StoryChartEditHandlers | null>(null);

export const useStoryChartEdit = () => useContext(StoryChartEditContext);

interface EditorStoryChartEditProviderProps {
	/**
	 * Applies an edited chart tag to the live editor buffer, given the chart's
	 * original `<chart ... />` tag and its replacement.
	 */
	onReplaceTag: (rawTag: string, nextTag: string) => void;
	children: React.ReactNode;
}

export function EditorStoryChartEditProvider({ onReplaceTag, children }: EditorStoryChartEditProviderProps) {
	const value = useMemo<StoryChartEditHandlers>(
		() => ({
			saveChart: async (rawTag, config) => {
				onReplaceTag(rawTag, buildStoryChartBlock(config));
			},
			isSaving: false,
			saveDescription: EDITOR_SAVE_DESCRIPTION,
		}),
		[onReplaceTag],
	);

	return <StoryChartEditContext.Provider value={value}>{children}</StoryChartEditContext.Provider>;
}

interface StoryChartEditProviderProps {
	chatId: string;
	storySlug: string;
	storyTitle: string;
	storyCode: string;
	children: React.ReactNode;
}

export function StoryChartEditProvider({
	chatId,
	storySlug,
	storyTitle,
	storyCode,
	children,
}: StoryChartEditProviderProps) {
	const { replaceBlock, isSaving } = useStoryBlockEdit({ chatId, storySlug, storyTitle, storyCode });

	const saveChart = useCallback(
		(rawTag: string, config: EditableChartInput) => replaceBlock(rawTag, buildStoryChartBlock(config)),
		[replaceBlock],
	);

	const filters = useMemo(() => dedupeFilters(getStoryFiltersFromCode(storyCode)), [storyCode]);

	const value = useMemo<StoryChartEditHandlers>(
		() => ({
			saveChart,
			isSaving,
			saveDescription: VERSION_SAVE_DESCRIPTION,
			story: { chatId, storySlug },
			filters,
			filterApi: { kind: 'owned', chatId, storySlug },
		}),
		[saveChart, isSaving, chatId, storySlug, filters],
	);

	return <StoryChartEditContext.Provider value={value}>{children}</StoryChartEditContext.Provider>;
}
