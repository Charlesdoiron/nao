import { useCallback, useMemo, useState } from 'react';
import type { ParsedChartBlock } from '@nao/shared/story-segments';

import type { QueryDataMap } from '@/components/story-embeds';
import type { DashboardFilter } from '@/lib/story-dashboard-filters';
import { collectDashboardBlocksFromCode, listFilterableColumns } from '@/lib/story-dashboard-filters';

export type ChartDisplayOverride = Partial<
	Pick<ParsedChartBlock, 'title' | 'chartType' | 'xAxisKey' | 'series' | 'showDataLabels' | 'hideTotal'>
>;

export interface BlockDisplayOverride extends ChartDisplayOverride {
	hiddenColumns?: string[];
}

export interface FilterDialogState {
	isOpen: boolean;
	editingFilterId: string | null;
	presetBlockKeys: string[];
}

const CLOSED_FILTER_DIALOG: FilterDialogState = { isOpen: false, editingFilterId: null, presetBlockKeys: [] };

export function useStoryDashboardEdit({ code, queryData }: { code: string; queryData: QueryDataMap | null }) {
	const [isEditing, setIsEditing] = useState(false);
	const [selectedBlockKeys, setSelectedBlockKeys] = useState<string[]>([]);
	const [filters, setFilters] = useState<DashboardFilter[]>([]);
	const [overrides, setOverrides] = useState<Record<string, BlockDisplayOverride>>({});
	const [inspectedBlockKey, setInspectedBlockKey] = useState<string | null>(null);
	const [highlightedFilterId, setHighlightedFilterId] = useState<string | null>(null);
	const [filterDialog, setFilterDialog] = useState<FilterDialogState>(CLOSED_FILTER_DIALOG);

	const blocks = useMemo(() => collectDashboardBlocksFromCode(code, queryData), [code, queryData]);
	const columns = useMemo(() => listFilterableColumns(blocks, queryData), [blocks, queryData]);

	const startEditing = useCallback(() => setIsEditing(true), []);

	const stopEditing = useCallback(() => {
		setIsEditing(false);
		setSelectedBlockKeys([]);
		setInspectedBlockKey(null);
		setHighlightedFilterId(null);
	}, []);

	const toggleBlockSelection = useCallback((blockKey: string) => {
		setSelectedBlockKeys((current) =>
			current.includes(blockKey) ? current.filter((key) => key !== blockKey) : [...current, blockKey],
		);
	}, []);

	const clearSelection = useCallback(() => setSelectedBlockKeys([]), []);

	const inspectBlock = useCallback((blockKey: string | null) => {
		setInspectedBlockKey(blockKey);
		if (blockKey) {
			setSelectedBlockKeys([blockKey]);
		}
	}, []);

	const saveFilter = useCallback((filter: DashboardFilter) => {
		setFilters((current) =>
			current.some((existing) => existing.id === filter.id)
				? current.map((existing) => (existing.id === filter.id ? filter : existing))
				: [...current, filter],
		);
	}, []);

	const updateFilter = useCallback((filterId: string, patch: Partial<DashboardFilter>) => {
		setFilters((current) => current.map((filter) => (filter.id === filterId ? { ...filter, ...patch } : filter)));
	}, []);

	const removeFilter = useCallback((filterId: string) => {
		setFilters((current) => current.filter((filter) => filter.id !== filterId));
		setHighlightedFilterId((current) => (current === filterId ? null : current));
	}, []);

	const clearFilterValues = useCallback(() => {
		setFilters((current) => current.map((filter) => ({ ...filter, values: [], dateRange: null })));
	}, []);

	const updateOverride = useCallback((blockKey: string, patch: BlockDisplayOverride) => {
		setOverrides((current) => ({ ...current, [blockKey]: { ...current[blockKey], ...patch } }));
	}, []);

	const resetOverride = useCallback((blockKey: string) => {
		setOverrides((current) => {
			const next = { ...current };
			delete next[blockKey];
			return next;
		});
	}, []);

	const openFilterDialog = useCallback(
		(options: { editingFilterId?: string; presetBlockKeys?: string[] } = {}) =>
			setFilterDialog({
				isOpen: true,
				editingFilterId: options.editingFilterId ?? null,
				presetBlockKeys: options.presetBlockKeys ?? [],
			}),
		[],
	);

	const closeFilterDialog = useCallback(() => setFilterDialog(CLOSED_FILTER_DIALOG), []);

	return {
		isEditing,
		startEditing,
		stopEditing,
		blocks,
		columns,
		queryData,
		selectedBlockKeys,
		toggleBlockSelection,
		clearSelection,
		inspectedBlockKey,
		inspectBlock,
		filters,
		saveFilter,
		updateFilter,
		removeFilter,
		clearFilterValues,
		highlightedFilterId,
		setHighlightedFilterId,
		overrides,
		updateOverride,
		resetOverride,
		filterDialog,
		openFilterDialog,
		closeFilterDialog,
	};
}

export type StoryDashboardEdit = ReturnType<typeof useStoryDashboardEdit>;
