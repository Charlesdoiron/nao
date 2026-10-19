import { ArchiveIcon, LayoutGrid, List, ListChecks, ShieldCheck, ThumbsUp, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { StoryPanelDisplayMode } from '@nao/shared/types';
import type { StoriesScope } from '@/lib/stories-page';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/use-permissions';

export function StoriesToolbarControls({
	scope,
	onScopeChange,
	displayMode,
	onDisplayModeChange,
	showArchived,
	onShowArchivedChange,
	selectionActive,
	onToggleSelection,
	newFeedbackCount,
}: {
	scope: StoriesScope;
	onScopeChange: (value: StoriesScope) => void;
	displayMode: StoryPanelDisplayMode;
	onDisplayModeChange: (value: StoryPanelDisplayMode) => void;
	showArchived: boolean;
	onShowArchivedChange: (value: boolean) => void;
	selectionActive: boolean;
	onToggleSelection: () => void;
	newFeedbackCount: number;
}) {
	const { isViewer } = usePermissions();
	return (
		<div className='flex items-center gap-3'>
			{!showArchived && (
				<ScopeToggle value={scope} onChange={onScopeChange} newFeedbackCount={newFeedbackCount} />
			)}
			{!isViewer && <SelectionToggle active={selectionActive} onToggle={onToggleSelection} />}
			<Button
				variant='ghost'
				size='sm'
				onClick={() => onShowArchivedChange(!showArchived)}
				className='text-foreground gap-1.5 rounded-full border'
			>
				<ArchiveIcon className='size-4' />
				<span className='text-xs'>{showArchived ? 'Back to stories' : 'See archives'}</span>
			</Button>
			<DisplayModeToggle value={displayMode} onChange={onDisplayModeChange} />
		</div>
	);
}

function ScopeToggle({
	value,
	onChange,
	newFeedbackCount,
}: {
	value: StoriesScope;
	onChange: (value: StoriesScope) => void;
	newFeedbackCount: number;
}) {
	return (
		<div className='flex items-center gap-0.5 rounded-full border p-0.5' role='group' aria-label='Filter stories'>
			<ScopeButton active={value === 'all'} onClick={() => onChange('all')}>
				All
			</ScopeButton>
			<ScopeButton active={value === 'certified'} onClick={() => onChange('certified')}>
				<ShieldCheck className='size-3.5' />
				Certified
			</ScopeButton>
			<ScopeButton active={value === 'feedback'} onClick={() => onChange('feedback')}>
				<ThumbsUp className='size-3.5' />
				Feedback
				{newFeedbackCount > 0 && (
					<span className='rounded-full bg-primary px-1.5 text-[10px] font-medium leading-4 text-primary-foreground tabular-nums'>
						{newFeedbackCount}
					</span>
				)}
			</ScopeButton>
		</div>
	);
}

function ScopeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
	return (
		<Button
			variant='ghost'
			size='sm'
			onClick={onClick}
			aria-pressed={active}
			className={cn(
				'h-6 gap-1.5 rounded-full px-2.5 text-xs hover:rounded-full',
				active ? 'bg-accent text-foreground' : 'text-muted-foreground',
			)}
		>
			{children}
		</Button>
	);
}

function SelectionToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
	return (
		<Button
			variant='ghost'
			size='sm'
			onClick={onToggle}
			aria-pressed={active}
			className={cn('text-foreground gap-1.5 rounded-full border', active && 'bg-accent')}
		>
			{active ? <X className='size-4' /> : <ListChecks className='size-4' />}
			<span className='text-xs'>{active ? 'Cancel' : 'Select'}</span>
		</Button>
	);
}

function DisplayModeToggle({
	value,
	onChange,
}: {
	value: StoryPanelDisplayMode;
	onChange: (value: StoryPanelDisplayMode) => void;
}) {
	return (
		<div className='flex items-center gap-0.5 rounded-full border p-0.5'>
			<Button
				variant='ghost'
				size='icon-xs'
				onClick={() => onChange('grid')}
				className={cn(value === 'grid' && 'bg-accent rounded-full', 'hover:rounded-full')}
				aria-label='Grid view'
			>
				<LayoutGrid />
			</Button>
			<Button
				variant='ghost'
				size='icon-xs'
				onClick={() => onChange('lines')}
				className={cn(value === 'lines' && 'bg-accent rounded-full', 'hover:rounded-full')}
				aria-label='List view'
			>
				<List />
			</Button>
		</div>
	);
}
