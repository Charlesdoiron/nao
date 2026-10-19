import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ArrowUpRight, ChevronRight, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type {
	StoryFeedbackFilter,
	StoryFeedbackRow,
	StoryFeedbackScope,
	StoryFeedbackSort,
} from '@/lib/story-feedback';
import type { TabBarItem } from '@/components/ui/tab-bar';
import { MobileHeader } from '@/components/mobile-header';
import { SearchBar } from '@/components/search-bar';
import { StoryFeedbackSummaryCards } from '@/components/story-feedback-summary';
import { StoryFeedbackTable } from '@/components/story-feedback-table';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { TabBar, TabPanel } from '@/components/ui/tab-bar';
import { usePermissions } from '@/hooks/use-permissions';
import { useSession } from '@/lib/auth-client';
import { requireNonViewer } from '@/lib/route-guards';
import {
	buildStoryFeedbackRows,
	selectStoryFeedbackRows,
	sortStoryFeedbackRows,
	summarizeStoryFeedback,
} from '@/lib/story-feedback';
import { getMockStoryFeedbackEntries } from '@/lib/story-feedback.mock';
import { cn } from '@/lib/utils';

interface StoryFeedbackSearch {
	scope?: StoryFeedbackScope;
	q?: string;
}

export const Route = createFileRoute('/_sidebar-layout/stories/feedback')({
	beforeLoad: requireNonViewer,
	validateSearch: validateStoryFeedbackSearch,
	component: StoryFeedbackPage,
});

const SCOPE_TABS_ID_BASE = 'story-feedback-scope';

const DEFAULT_SORT: StoryFeedbackSort = { field: 'lastFeedback', direction: 'desc' };

const SCOPE_DESCRIPTIONS: Record<StoryFeedbackScope, string> = {
	mine: 'Thumbs up and down left by readers on the stories you own, including the ones you pinned or shared with everyone.',
	all: 'Every thumbs up and down left on shared stories across this project.',
};

function StoryFeedbackPage() {
	const { isAdmin } = usePermissions();
	const { data: session } = useSession();
	const navigate = useNavigate();
	const search = Route.useSearch();
	const [sort, setSort] = useState<StoryFeedbackSort>(DEFAULT_SORT);
	const [filter, setFilter] = useState<StoryFeedbackFilter>('all');

	const scope: StoryFeedbackScope = isAdmin ? (search.scope ?? 'all') : 'mine';
	const query = search.q ?? '';

	const allRows = useMemo(
		() => buildStoryFeedbackRows(getMockStoryFeedbackEntries(session?.user?.name ?? 'Me')),
		[session?.user?.name],
	);
	const scopedRows = useMemo(
		() => selectStoryFeedbackRows(allRows, { scope, query: '', filter: 'all' }),
		[allRows, scope],
	);
	const summary = useMemo(() => summarizeStoryFeedback(scopedRows), [scopedRows]);
	const visibleRows = useMemo(
		() => sortStoryFeedbackRows(selectStoryFeedbackRows(scopedRows, { scope, query, filter }), sort),
		[scopedRows, scope, query, filter, sort],
	);

	const updateSearch = (next: StoryFeedbackSearch) => {
		navigate({ to: '/stories/feedback', search: { scope: search.scope, q: search.q, ...next }, replace: true });
	};

	const scopeTabs: TabBarItem<StoryFeedbackScope>[] = [
		{ id: 'all', label: 'All stories', count: allRows.length },
		{ id: 'mine', label: 'My stories', count: allRows.filter((row) => row.isOwnedByCurrentUser).length },
	];

	return (
		<div className='flex flex-col flex-1 h-full overflow-auto'>
			<MobileHeader />
			<div className='mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10'>
				<StoryFeedbackPageHeader description={SCOPE_DESCRIPTIONS[scope]} />

				{isAdmin && (
					<div className='border-b'>
						<TabBar
							tabs={scopeTabs}
							activeTab={scope}
							onTabChange={(nextScope) => updateSearch({ scope: nextScope })}
							idBase={SCOPE_TABS_ID_BASE}
						/>
					</div>
				)}

				<TabPanel idBase={SCOPE_TABS_ID_BASE} tabId={scope} className='flex flex-col gap-6'>
					<StoryFeedbackSummaryCards summary={summary} />

					{isAdmin && scope === 'all' && <RecommendationsCallout />}

					<div className='flex flex-wrap items-center justify-between gap-3'>
						<SearchBar
							value={query}
							onChange={(nextQuery) => updateSearch({ q: nextQuery || undefined })}
							placeholder={scope === 'all' ? 'Search stories or owners...' : 'Search your stories...'}
							ariaLabel='Search story feedback'
						/>
						<FeedbackFilterToggle
							value={filter}
							onChange={setFilter}
							attentionCount={summary.storiesNeedingAttention}
						/>
					</div>

					<StoryFeedbackTable
						rows={visibleRows}
						sort={sort}
						onSortChange={setSort}
						showOwner={scope === 'all'}
						emptyLabel={getEmptyLabel(scopedRows, query, filter)}
					/>
				</TabPanel>
			</div>
		</div>
	);
}

function StoryFeedbackPageHeader({ description }: { description: string }) {
	return (
		<div className='flex flex-col gap-1'>
			<div className='flex items-center gap-1.5 text-xl font-semibold tracking-tight'>
				<Link
					to='/stories'
					search={{ folderId: null }}
					className='text-muted-foreground transition-colors hover:text-foreground'
				>
					Stories
				</Link>
				<ChevronRight className='size-4 text-muted-foreground' />
				<h1>Feedback</h1>
			</div>
			<p className='text-sm text-muted-foreground'>{description}</p>
		</div>
	);
}

function RecommendationsCallout() {
	return (
		<Callout icon={Sparkles} className='items-center text-xs'>
			<div className='flex flex-wrap items-center justify-between gap-2'>
				<span>
					Negative story feedback is now part of each <strong>Context recommendations</strong> run. When the
					fix belongs to the story rather than the context, the recommendation points to the story owner.
				</span>
				<Link
					to='/settings/recommendations'
					search={{ tab: 'recommendations', openChats: undefined }}
					className='inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline'
				>
					Open recommendations
					<ArrowUpRight className='size-3.5' />
				</Link>
			</div>
		</Callout>
	);
}

function FeedbackFilterToggle({
	value,
	onChange,
	attentionCount,
}: {
	value: StoryFeedbackFilter;
	onChange: (value: StoryFeedbackFilter) => void;
	attentionCount: number;
}) {
	return (
		<div className='flex items-center gap-0.5 rounded-full border p-0.5' role='group' aria-label='Filter feedback'>
			<FilterButton isActive={value === 'all'} onClick={() => onChange('all')}>
				All
			</FilterButton>
			<FilterButton isActive={value === 'attention'} onClick={() => onChange('attention')}>
				Needs attention
				<span className='text-muted-foreground tabular-nums'>{attentionCount}</span>
			</FilterButton>
		</div>
	);
}

function FilterButton({
	isActive,
	onClick,
	children,
}: {
	isActive: boolean;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<Button
			variant='ghost'
			size='sm'
			onClick={onClick}
			aria-pressed={isActive}
			className={cn(
				'h-6 gap-1.5 rounded-full px-2.5 text-xs hover:rounded-full',
				isActive ? 'bg-accent text-foreground' : 'text-muted-foreground',
			)}
		>
			{children}
		</Button>
	);
}

function getEmptyLabel(scopedRows: StoryFeedbackRow[], query: string, filter: StoryFeedbackFilter): string {
	if (scopedRows.length === 0) {
		return 'No feedback yet. Share or pin a story to start collecting thumbs up and down.';
	}
	if (query || filter !== 'all') {
		return 'No stories match your search.';
	}
	return 'No feedback yet.';
}

function validateStoryFeedbackSearch(search: Record<string, unknown>): StoryFeedbackSearch {
	return {
		scope: search.scope === 'mine' || search.scope === 'all' ? search.scope : undefined,
		q: typeof search.q === 'string' && search.q.length > 0 ? search.q : undefined,
	};
}
