import { createFileRoute } from '@tanstack/react-router';
import { Code } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { SourceQuery } from '@/lib/execute-sql-messages';

import { StoryFilterBar } from '@/components/story-filter-bar';
import { ChartConfigEditDialog } from '@/components/tool-calls/display-chart-edit-dialog';
import { Button } from '@/components/ui/button';
import {
	createPrototypeFilterEditing,
	PROTOTYPE_INVALID_SQL,
	PROTOTYPE_OUTPUT,
	PROTOTYPE_STORY_FILTERS,
	PROTOTYPE_VALID_SQL,
} from '@/lib/sql-filter-prototype-data';

type PrototypeVariant = 'before' | 'after';
type PrototypeScenario = 'valid' | 'lint';

export const Route = createFileRoute('/_sidebar-layout/prototype/sql-filters')({
	validateSearch: (search: Record<string, unknown>): { variant: PrototypeVariant; scenario: PrototypeScenario } => ({
		variant: search.variant === 'before' ? 'before' : 'after',
		scenario: search.scenario === 'lint' ? 'lint' : 'valid',
	}),
	component: SqlFiltersPrototypePage,
});

const CHART_CONFIG: React.ComponentProps<typeof ChartConfigEditDialog>['config'] = {
	query_id: PROTOTYPE_OUTPUT.id,
	chart_type: 'line',
	x_axis_key: 'month',
	x_axis_type: 'date',
	series: [{ data_key: 'revenue', label: 'Revenue' }],
	title: 'Monthly revenue',
};

/** Prototype for getnao/nao#1989: the chart editor's "Edit SQL" view for a story query that uses filters. */
function SqlFiltersPrototypePage() {
	const { variant, scenario } = Route.useSearch();
	const [isOpen, setIsOpen] = useState(true);
	const filterEditing = useMemo(() => (variant === 'after' ? createPrototypeFilterEditing() : undefined), [variant]);
	const sourceQuery = useMemo<SourceQuery>(
		() => ({
			input: { sql_query: scenario === 'lint' ? PROTOTYPE_INVALID_SQL : PROTOTYPE_VALID_SQL },
			output: PROTOTYPE_OUTPUT,
		}),
		[scenario],
	);

	return (
		<div className='flex min-w-0 flex-1 flex-col gap-6 overflow-auto bg-background p-10'>
			<div className='flex flex-col gap-1'>
				<h1 className='text-2xl font-semibold text-foreground'>Revenue review</h1>
				<p className='text-sm text-muted-foreground'>Prototype story with filters (mocked data).</p>
			</div>
			<StoryFilterBar
				filters={PROTOTYPE_STORY_FILTERS}
				selections={{}}
				onSelectionChange={() => {}}
				onClear={() => {}}
			/>
			<div className='flex items-center justify-between rounded-lg border p-4'>
				<span className='text-sm font-medium'>Monthly revenue</span>
				<Button variant='outline' size='sm' onClick={() => setIsOpen(true)}>
					<Code className='size-3.5' /> Edit SQL query
				</Button>
			</div>
			<ChartConfigEditDialog
				key={`${variant}-${scenario}`}
				open={isOpen}
				onOpenChange={setIsOpen}
				config={CHART_CONFIG}
				availableColumns={PROTOTYPE_OUTPUT.columns}
				data={PROTOTYPE_OUTPUT.data as Record<string, unknown>[]}
				onSave={async () => setIsOpen(false)}
				sourceQuery={sourceQuery}
				initialView='query'
				filterEditing={filterEditing}
			/>
		</div>
	);
}
