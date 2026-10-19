import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ParsedChartBlock, ParsedTableBlock } from '@nao/shared/story-segments';

import type { QueryDataMap } from '@/components/story-embeds';
import type { BlockDisplaySettings, ManualFilter, StoryControlBlock } from '@/lib/story-controls';
import {
	applyChartDisplaySettings,
	collectStoryBlocks,
	collectStoryColumns,
	filterBlockRows,
	getChartBlockId,
	getResultColumns,
	getTableBlockId,
	isManualFilterActive,
} from '@/lib/story-controls';

interface StoryControlsState {
	filters: ManualFilter[];
	displaySettings: Record<string, BlockDisplaySettings>;
}

const EMPTY_STATE: StoryControlsState = { filters: [], displaySettings: {} };
const STORAGE_KEY_PREFIX = 'nao:story-controls:';

export type StoryControls = ReturnType<typeof useStoryControls>;

export function useStoryControls({
	storyKey,
	code,
	queryData,
}: {
	storyKey: string | null;
	code: string;
	queryData: QueryDataMap | null;
}) {
	const [state, setState] = useState<StoryControlsState>(() => readState(storyKey));
	const [draftFilter, setDraftFilter] = useState<ManualFilter | null>(null);
	const blocks = useMemo(() => collectStoryBlocks(code), [code]);
	const columns = useMemo(() => collectStoryColumns(blocks, queryData), [blocks, queryData]);

	useEffect(() => {
		setState(readState(storyKey));
	}, [storyKey]);

	const updateState = useCallback(
		(update: (current: StoryControlsState) => StoryControlsState) => {
			setState((current) => {
				const next = update(current);
				writeState(storyKey, next);
				return next;
			});
		},
		[storyKey],
	);

	const saveFilter = useCallback(
		(filter: ManualFilter) =>
			updateState((current) => {
				const exists = current.filters.some((candidate) => candidate.id === filter.id);
				const filters = exists
					? current.filters.map((candidate) => (candidate.id === filter.id ? filter : candidate))
					: [...current.filters, filter];
				return { ...current, filters };
			}),
		[updateState],
	);

	const removeFilter = useCallback(
		(filterId: string) =>
			updateState((current) => ({
				...current,
				filters: current.filters.filter((filter) => filter.id !== filterId),
			})),
		[updateState],
	);

	const clearFilters = useCallback(() => updateState((current) => ({ ...current, filters: [] })), [updateState]);

	const updateDisplaySettings = useCallback(
		(blockId: string, settings: BlockDisplaySettings) =>
			updateState((current) => ({
				...current,
				displaySettings: {
					...current.displaySettings,
					[blockId]: { ...current.displaySettings[blockId], ...settings },
				},
			})),
		[updateState],
	);

	const resetDisplaySettings = useCallback(
		(blockId: string) =>
			updateState((current) => {
				const displaySettings = { ...current.displaySettings };
				delete displaySettings[blockId];
				return { ...current, displaySettings };
			}),
		[updateState],
	);

	const savedActiveFilterCount = useMemo(() => state.filters.filter(isManualFilterActive).length, [state.filters]);
	const activeFilters = useMemo(() => {
		const filters = draftFilter
			? [...state.filters.filter((filter) => filter.id !== draftFilter.id), draftFilter]
			: state.filters;
		return filters.filter(isManualFilterActive);
	}, [state.filters, draftFilter]);

	const deriveChart = useCallback(
		(chart: ParsedChartBlock, data: QueryDataMap | null) => {
			const blockId = getChartBlockId(chart);
			const block = blocks.find((candidate) => candidate.id === blockId);
			return {
				chart: applyChartDisplaySettings(chart, state.displaySettings[blockId]),
				queryData: filterBlockQueryData(block, data, activeFilters),
			};
		},
		[state.displaySettings, activeFilters, blocks],
	);

	const deriveTable = useCallback(
		(table: ParsedTableBlock, data: QueryDataMap | null) => {
			const blockId = getTableBlockId(table);
			const block = blocks.find((candidate) => candidate.id === blockId);
			const derived = filterBlockQueryData(block, data, activeFilters);
			const visibleColumns = state.displaySettings[blockId]?.visibleColumns;
			const result = derived?.[table.queryId];
			if (!derived || !result || !visibleColumns) {
				return derived;
			}
			const tableColumns = getResultColumns(result).filter((column) => visibleColumns.includes(column));
			return { ...derived, [table.queryId]: { ...result, columns: tableColumns } };
		},
		[state.displaySettings, activeFilters, blocks],
	);

	return {
		blocks,
		columns,
		filters: state.filters,
		activeFilterCount: savedActiveFilterCount,
		isPreviewingFilter: draftFilter !== null,
		displaySettings: state.displaySettings,
		saveFilter,
		previewFilter: setDraftFilter,
		removeFilter,
		clearFilters,
		updateDisplaySettings,
		resetDisplaySettings,
		deriveChart,
		deriveTable,
	};
}

function filterBlockQueryData(
	block: StoryControlBlock | undefined,
	data: QueryDataMap | null,
	filters: ManualFilter[],
): QueryDataMap | null {
	const result = block ? data?.[block.queryId] : undefined;
	if (!data || !block || !result) {
		return data;
	}
	const rows = filterBlockRows(block, result.data, filters);
	return rows === result.data ? data : { ...data, [block.queryId]: { ...result, data: rows } };
}

function readState(storyKey: string | null): StoryControlsState {
	if (!storyKey || typeof window === 'undefined') {
		return EMPTY_STATE;
	}
	try {
		const stored = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${storyKey}`);
		return stored ? { ...EMPTY_STATE, ...(JSON.parse(stored) as StoryControlsState) } : EMPTY_STATE;
	} catch {
		return EMPTY_STATE;
	}
}

function writeState(storyKey: string | null, state: StoryControlsState) {
	if (!storyKey || typeof window === 'undefined') {
		return;
	}
	window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${storyKey}`, JSON.stringify(state));
}
