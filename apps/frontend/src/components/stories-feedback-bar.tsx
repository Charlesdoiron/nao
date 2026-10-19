import { MessageSquareText, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { ReactNode } from 'react';

import type {
	StoryFeedbackFilters,
	StoryFeedbackOwnerFilter,
	StoryFeedbackSentiment,
	StoryFeedbackStats,
} from '@/lib/story-feedback';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function StoriesFeedbackBar({
	stats,
	filters,
	onFiltersChange,
	showOwnerFilter,
	className,
}: {
	stats: StoryFeedbackStats;
	filters: StoryFeedbackFilters;
	onFiltersChange: (filters: StoryFeedbackFilters) => void;
	showOwnerFilter: boolean;
	className?: string;
}) {
	function update(patch: Partial<StoryFeedbackFilters>) {
		onFiltersChange({ ...filters, ...patch });
	}

	return (
		<div className={cn('flex flex-col gap-3', className)}>
			<div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
				<Stat label='Stories with feedback' value={String(stats.storyCount)} />
				<Stat label='Ratings' value={String(stats.total)} />
				<Stat
					label='Positive'
					value={stats.positiveRate === null ? '—' : `${stats.positiveRate}%`}
					hint={`${stats.negativeStoryCount} stor${stats.negativeStoryCount === 1 ? 'y' : 'ies'} flagged`}
				/>
				<Stat label='New since last review' value={String(stats.newCount)} highlight={stats.newCount > 0} />
			</div>

			<div className='flex flex-wrap items-center gap-2'>
				<SegmentedGroup ariaLabel='Filter by sentiment'>
					<SegmentButton active={filters.sentiment === 'all'} onClick={() => update({ sentiment: 'all' })}>
						All ratings
					</SegmentButton>
					<SegmentButton
						active={filters.sentiment === 'negative'}
						onClick={() => update({ sentiment: toggleSentiment(filters.sentiment, 'negative') })}
					>
						<ThumbsDown className='size-3' />
						Negative
					</SegmentButton>
					<SegmentButton
						active={filters.sentiment === 'positive'}
						onClick={() => update({ sentiment: toggleSentiment(filters.sentiment, 'positive') })}
					>
						<ThumbsUp className='size-3' />
						Positive
					</SegmentButton>
				</SegmentedGroup>

				<ToggleChip
					active={filters.withComments}
					onClick={() => update({ withComments: !filters.withComments })}
				>
					<MessageSquareText className='size-3' />
					With comments
				</ToggleChip>
				<ToggleChip active={filters.newOnly} onClick={() => update({ newOnly: !filters.newOnly })}>
					<Sparkles className='size-3' />
					New only
				</ToggleChip>

				{showOwnerFilter && (
					<SegmentedGroup ariaLabel='Filter by owner' className='ml-auto'>
						<OwnerButton value='anyone' current={filters.owner} onChange={(owner) => update({ owner })}>
							All stories
						</OwnerButton>
						<OwnerButton value='mine' current={filters.owner} onChange={(owner) => update({ owner })}>
							My stories
						</OwnerButton>
					</SegmentedGroup>
				)}
			</div>
		</div>
	);
}

function Stat({ label, value, hint, highlight }: { label: string; value: string; hint?: string; highlight?: boolean }) {
	return (
		<div className='rounded-lg border px-3 py-2'>
			<div className='text-[11px] text-muted-foreground'>{label}</div>
			<div className='flex items-baseline gap-2'>
				<span className={cn('text-lg font-semibold tabular-nums', highlight && 'text-primary')}>{value}</span>
				{hint && <span className='text-[11px] text-muted-foreground'>{hint}</span>}
			</div>
		</div>
	);
}

function SegmentedGroup({
	ariaLabel,
	className,
	children,
}: {
	ariaLabel: string;
	className?: string;
	children: ReactNode;
}) {
	return (
		<div
			className={cn('flex items-center gap-0.5 rounded-full border p-0.5', className)}
			role='group'
			aria-label={ariaLabel}
		>
			{children}
		</div>
	);
}

function SegmentButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
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

function OwnerButton({
	value,
	current,
	onChange,
	children,
}: {
	value: StoryFeedbackOwnerFilter;
	current: StoryFeedbackOwnerFilter;
	onChange: (value: StoryFeedbackOwnerFilter) => void;
	children: ReactNode;
}) {
	return (
		<SegmentButton active={current === value} onClick={() => onChange(value)}>
			{children}
		</SegmentButton>
	);
}

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
	return (
		<Button
			variant='ghost'
			size='sm'
			onClick={onClick}
			aria-pressed={active}
			className={cn(
				'h-7 gap-1.5 rounded-full border px-2.5 text-xs',
				active ? 'bg-accent text-foreground border-foreground/20' : 'text-muted-foreground',
			)}
		>
			{children}
		</Button>
	);
}

function toggleSentiment(current: StoryFeedbackSentiment, next: StoryFeedbackSentiment): StoryFeedbackSentiment {
	return current === next ? 'all' : next;
}
