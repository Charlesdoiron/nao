import { FileText, History } from 'lucide-react';

import type { TabBarItem } from '@/components/ui/tab-bar';
import type { StoryPageView } from '@/hooks/use-story-page-view';
import type { StoryRefreshRun } from '@/lib/story-refresh-history';
import { RefreshStatusIcon } from '@/components/story-refresh-status';
import { TabBar } from '@/components/ui/tab-bar';
import { countSucceededQueries, formatRefreshDate, REFRESH_STATUS_LABELS } from '@/lib/story-refresh-history';

interface StoryViewTabsProps {
	activeView: StoryPageView;
	latestRun: StoryRefreshRun | null;
	onShowStory: () => void;
	onShowRefreshHistory: (selection?: { runId?: string }) => void;
}

export function StoryViewTabs({ activeView, latestRun, onShowStory, onShowRefreshHistory }: StoryViewTabsProps) {
	const hasLatestFailure = latestRun !== null && latestRun.status !== 'success';
	const tabs: TabBarItem<StoryPageView>[] = [
		{ id: 'story', label: 'Story', icon: <FileText className='size-3.5' strokeWidth={2.25} /> },
		{
			id: 'refresh-history',
			label: (
				<span className='flex items-center gap-1.5'>
					Refresh history
					{hasLatestFailure && (
						<span aria-label='Last refresh had failures' className='size-1.5 rounded-full bg-destructive' />
					)}
				</span>
			),
			icon: <History className='size-3.5' strokeWidth={2.25} />,
		},
	];

	const handleTabChange = (view: StoryPageView) => {
		if (view === 'story') {
			onShowStory();
		} else {
			onShowRefreshHistory();
		}
	};

	return (
		<div className='flex shrink-0 items-center gap-3 border-b bg-background px-2 md:px-4'>
			<TabBar tabs={tabs} activeTab={activeView} onTabChange={handleTabChange} idBase='story-view' />
			{latestRun && (
				<button
					type='button'
					onClick={() => onShowRefreshHistory({ runId: latestRun.id })}
					className='ml-auto flex min-w-0 cursor-pointer items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground'
				>
					<RefreshStatusIcon status={latestRun.status} />
					<span className='truncate'>
						Last refresh {REFRESH_STATUS_LABELS[latestRun.status].toLowerCase()} ·{' '}
						{countSucceededQueries(latestRun)}/{latestRun.queries.length} queries ·{' '}
						{formatRefreshDate(latestRun.startedAt)}
					</span>
				</button>
			)}
		</div>
	);
}
