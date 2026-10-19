import { Check, Filter, LayoutDashboard, SlidersHorizontal, X } from 'lucide-react';

import type { StoryDashboardEdit } from '@/hooks/use-story-dashboard-edit';
import { Button } from '@/components/ui/button';

export function StoryDashboardEditBar({ dashboard }: { dashboard: StoryDashboardEdit }) {
	if (!dashboard.isEditing) {
		return null;
	}

	const selectedCount = dashboard.selectedBlockKeys.length;
	const singleSelectedKey = selectedCount === 1 ? dashboard.selectedBlockKeys[0] : null;

	return (
		<div className='flex shrink-0 items-center gap-3 border-b bg-violet-500/[0.06] px-4 py-2 md:px-6'>
			<div className='flex min-w-0 items-center gap-2 text-xs'>
				<span className='flex items-center gap-1.5 rounded-full bg-violet-500/15 px-2 py-0.5 font-medium text-violet-700 dark:text-violet-300'>
					<LayoutDashboard className='size-3' />
					Editing dashboard
				</span>
				{selectedCount === 0 ? (
					<span className='truncate text-muted-foreground'>
						Click charts to select them, then add a filter or change how they display.
					</span>
				) : (
					<span className='flex items-center gap-1 text-foreground'>
						<span className='font-medium'>
							{selectedCount} {selectedCount === 1 ? 'block' : 'blocks'} selected
						</span>
						<button
							type='button'
							onClick={dashboard.clearSelection}
							className='flex items-center gap-0.5 rounded-sm px-1 text-muted-foreground hover:bg-muted hover:text-foreground'
						>
							<X className='size-3' />
							Clear
						</button>
					</span>
				)}
			</div>

			<div className='ml-auto flex shrink-0 items-center gap-2'>
				<Button
					variant='outline'
					size='sm'
					className='gap-1.5'
					onClick={() => dashboard.openFilterDialog({ presetBlockKeys: dashboard.selectedBlockKeys })}
				>
					<Filter className='size-3' />
					{selectedCount > 1 ? `Filter ${selectedCount} blocks` : 'Add filter'}
				</Button>
				<Button
					variant='outline'
					size='sm'
					className='gap-1.5'
					disabled={!singleSelectedKey}
					title={singleSelectedKey ? undefined : 'Select a single block to edit its display'}
					onClick={() => dashboard.inspectBlock(singleSelectedKey)}
				>
					<SlidersHorizontal className='size-3' />
					Display options
				</Button>
				<Button variant='primary-gradient' size='sm' className='gap-1.5' onClick={dashboard.stopEditing}>
					<Check className='size-3' strokeWidth={2.5} />
					Done
				</Button>
			</div>
		</div>
	);
}
