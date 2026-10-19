import { Calendar, ChartColumn, Filter, Hash, SlidersHorizontal, Table2, Type } from 'lucide-react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { ParsedChartBlock, ParsedTableBlock } from '@nao/shared/story-segments';

import type { QueryDataMap } from '@/components/story-embeds';
import type { DashboardBlockKind, DashboardColumnKind, DashboardFilter } from '@/lib/story-dashboard-filters';
import type { StoryDashboardEdit } from '@/hooks/use-story-dashboard-edit';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useStoryDashboardEditContext } from '@/contexts/story-dashboard-edit';
import {
	applyDashboardFilters,
	describeDashboardFilter,
	getActiveFiltersForBlock,
	getDashboardBlockKey,
} from '@/lib/story-dashboard-filters';
import { cn } from '@/lib/utils';

interface DashboardBlockRenderProps {
	queryData: QueryDataMap | null;
	hasActiveFilters: boolean;
}

export function DashboardChartBlock({
	chart,
	queryData,
	hasActiveFilters,
	render,
}: DashboardBlockRenderProps & {
	chart: ParsedChartBlock;
	render: (chart: ParsedChartBlock, options: DashboardBlockRenderProps) => ReactNode;
}) {
	const dashboard = useStoryDashboardEditContext();
	const blockKey = getDashboardBlockKey('chart', chart.queryId, chart.title);
	const override = dashboard?.overrides[blockKey];
	const effectiveChart = useMemo(() => ({ ...chart, ...override }), [chart, override]);
	const filtered = useFilteredQueryData(dashboard, blockKey, chart.queryId, queryData);

	const content = render(effectiveChart, {
		queryData: filtered.queryData,
		hasActiveFilters: hasActiveFilters || filtered.activeFilters.length > 0,
	});

	if (!dashboard) {
		return content;
	}

	return (
		<DashboardBlockFrame
			dashboard={dashboard}
			blockKey={blockKey}
			kind='chart'
			activeFilters={filtered.activeFilters}
		>
			{content}
		</DashboardBlockFrame>
	);
}

export function DashboardTableBlock({
	table,
	queryData,
	hasActiveFilters,
	render,
}: DashboardBlockRenderProps & {
	table: ParsedTableBlock;
	render: (table: ParsedTableBlock, options: DashboardBlockRenderProps) => ReactNode;
}) {
	const dashboard = useStoryDashboardEditContext();
	const blockKey = getDashboardBlockKey('table', table.queryId, table.title);
	const hiddenColumns = dashboard?.overrides[blockKey]?.hiddenColumns;
	const filtered = useFilteredQueryData(dashboard, blockKey, table.queryId, queryData, hiddenColumns);

	const content = render(table, {
		queryData: filtered.queryData,
		hasActiveFilters: hasActiveFilters || filtered.activeFilters.length > 0,
	});

	if (!dashboard) {
		return content;
	}

	return (
		<DashboardBlockFrame
			dashboard={dashboard}
			blockKey={blockKey}
			kind='table'
			activeFilters={filtered.activeFilters}
		>
			{content}
		</DashboardBlockFrame>
	);
}

function DashboardBlockFrame({
	dashboard,
	blockKey,
	kind,
	activeFilters,
	children,
}: {
	dashboard: StoryDashboardEdit;
	blockKey: string;
	kind: DashboardBlockKind;
	activeFilters: DashboardFilter[];
	children: ReactNode;
}) {
	const isSelected = dashboard.selectedBlockKeys.includes(blockKey);
	const isInspected = dashboard.inspectedBlockKey === blockKey;
	const highlightedFilter = dashboard.filters.find((filter) => filter.id === dashboard.highlightedFilterId);
	const isHighlighted = Boolean(highlightedFilter?.targetBlockKeys.includes(blockKey));

	if (!dashboard.isEditing) {
		return (
			<div className='flex flex-col'>
				{children}
				<AppliedFilterBadges filters={activeFilters} />
			</div>
		);
	}

	const block = dashboard.blocks.find((candidate) => candidate.key === blockKey);
	const KindIcon = kind === 'chart' ? ChartColumn : Table2;

	return (
		<div
			role='button'
			tabIndex={0}
			aria-pressed={isSelected}
			onClick={() => dashboard.toggleBlockSelection(blockKey)}
			onKeyDown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					dashboard.toggleBlockSelection(blockKey);
				}
			}}
			className={cn(
				'group/block relative my-3 cursor-pointer rounded-xl border border-dashed bg-background px-4 pt-5 pb-3 outline-none transition-all',
				'hover:border-foreground/30 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring/50',
				isSelected && 'border-solid border-violet-500 shadow-md ring-4 ring-violet-500/15',
				isHighlighted && !isSelected && 'border-solid border-amber-400 ring-4 ring-amber-400/20',
			)}
		>
			<div className='absolute -top-3 left-3 flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground shadow-xs'>
				<Checkbox
					checked={isSelected}
					className='size-3.5'
					aria-label={isSelected ? 'Deselect block' : 'Select block'}
					onClick={(event) => event.stopPropagation()}
					onCheckedChange={() => dashboard.toggleBlockSelection(blockKey)}
				/>
				<KindIcon className='size-3' />
				<span>{kind === 'chart' ? 'Chart' : 'Table'}</span>
			</div>

			<div
				className={cn(
					'absolute -top-3.5 right-3 flex items-center gap-1 rounded-full border bg-background p-0.5 shadow-xs transition-opacity',
					isSelected || isInspected ? 'opacity-100' : 'opacity-0 group-hover/block:opacity-100',
				)}
			>
				<Button
					variant='ghost'
					size='sm'
					className='h-6 gap-1 rounded-full px-2 text-xs'
					onClick={(event) => {
						event.stopPropagation();
						dashboard.openFilterDialog({
							presetBlockKeys: uniqueKeys([...dashboard.selectedBlockKeys, blockKey]),
						});
					}}
				>
					<Filter className='size-3' />
					Filter
				</Button>
				<Button
					variant='ghost'
					size='sm'
					className={cn('h-6 gap-1 rounded-full px-2 text-xs', isInspected && 'bg-accent')}
					onClick={(event) => {
						event.stopPropagation();
						dashboard.inspectBlock(isInspected ? null : blockKey);
					}}
				>
					<SlidersHorizontal className='size-3' />
					{kind === 'chart' ? 'Display' : 'Columns'}
				</Button>
			</div>

			<div className='pointer-events-none select-none'>{children}</div>

			<div className='mt-2 flex flex-wrap items-center gap-1.5 border-t border-dashed pt-2'>
				<span className='text-[11px] text-muted-foreground'>Exposes</span>
				{(block?.columns ?? []).map((column) => {
					const columnKind = dashboard.columns.find((candidate) => candidate.name === column)?.kind ?? 'text';
					return <ColumnChip key={column} name={column} kind={columnKind} />;
				})}
				{activeFilters.length > 0 && (
					<span className='ml-auto flex items-center gap-1 text-[11px] font-medium text-violet-600 dark:text-violet-400'>
						<Filter className='size-3' />
						{activeFilters.length} {activeFilters.length === 1 ? 'filter' : 'filters'} applied
					</span>
				)}
			</div>
		</div>
	);
}

function AppliedFilterBadges({ filters }: { filters: DashboardFilter[] }) {
	if (filters.length === 0) {
		return null;
	}
	return (
		<div className='-mt-1 mb-2 flex flex-wrap items-center gap-1.5'>
			{filters.map((filter) => (
				<span
					key={filter.id}
					className='inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground'
				>
					<Filter className='size-2.5' />
					<span className='font-medium text-foreground/80'>{filter.label}</span>
					<span>{describeDashboardFilter(filter)}</span>
				</span>
			))}
		</div>
	);
}

export function ColumnChip({ name, kind }: { name: string; kind: DashboardColumnKind }) {
	const Icon = COLUMN_KIND_ICONS[kind];
	return (
		<span className='inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground'>
			<Icon className='size-2.5' />
			{name}
		</span>
	);
}

export const COLUMN_KIND_ICONS: Record<DashboardColumnKind, typeof Calendar> = {
	date: Calendar,
	text: Type,
	number: Hash,
};

function useFilteredQueryData(
	dashboard: StoryDashboardEdit | null,
	blockKey: string,
	queryId: string,
	queryData: QueryDataMap | null,
	hiddenColumns?: string[],
) {
	const filters = dashboard?.filters;
	return useMemo(() => {
		const activeFilters = filters ? getActiveFiltersForBlock(blockKey, filters) : [];
		const entry = queryData?.[queryId];
		if (!entry || (activeFilters.length === 0 && !hiddenColumns?.length)) {
			return { queryData, activeFilters };
		}
		return {
			activeFilters,
			queryData: {
				...queryData,
				[queryId]: {
					columns: hiddenColumns?.length
						? entry.columns.filter((column) => !hiddenColumns.includes(column))
						: entry.columns,
					data: applyDashboardFilters(entry.data, blockKey, activeFilters),
				},
			},
		};
	}, [filters, blockKey, queryData, queryId, hiddenColumns]);
}

function uniqueKeys(keys: string[]): string[] {
	return [...new Set(keys)];
}
