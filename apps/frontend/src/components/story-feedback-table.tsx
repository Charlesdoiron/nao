import { ArrowDown, ArrowUp, ChevronRight, Globe, Pin, ThumbsDown, ThumbsUp, Users } from 'lucide-react';
import { Fragment, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import type {
	StoryFeedbackRow,
	StoryFeedbackSort,
	StoryFeedbackSortField,
	StoryFeedbackVisibility,
	StoryFeedbackVote,
} from '@/lib/story-feedback';
import { Empty } from '@/components/ui/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTimeAgo } from '@/hooks/use-time-ago';
import { formatApprovalRate, STORY_FEEDBACK_VISIBILITY_LABELS } from '@/lib/story-feedback';
import { cn } from '@/lib/utils';

const VISIBILITY_ICONS: Record<StoryFeedbackVisibility, LucideIcon> = {
	pinned: Pin,
	project: Globe,
	group: Users,
};

const RECENT_VOTES_LIMIT = 8;

interface StoryFeedbackTableProps {
	rows: StoryFeedbackRow[];
	sort: StoryFeedbackSort;
	onSortChange: (sort: StoryFeedbackSort) => void;
	showOwner: boolean;
	emptyLabel: string;
}

export function StoryFeedbackTable({ rows, sort, onSortChange, showOwner, emptyLabel }: StoryFeedbackTableProps) {
	const [expandedStoryId, setExpandedStoryId] = useState<string | null>(null);
	const columnCount = showOwner ? 7 : 6;

	const handleSort = (field: StoryFeedbackSortField) => {
		const isSameField = sort.field === field;
		onSortChange({ field, direction: isSameField && sort.direction === 'desc' ? 'asc' : 'desc' });
	};

	const toggleExpanded = (storyId: string) => {
		setExpandedStoryId((current) => (current === storyId ? null : storyId));
	};

	return (
		<div className='rounded-lg border'>
			<Table>
				<TableHeader>
					<TableRow className='hover:bg-transparent'>
						<TableHead className='w-8' />
						<SortableHead field='title' sort={sort} onSort={handleSort}>
							Story
						</SortableHead>
						{showOwner && (
							<SortableHead field='owner' sort={sort} onSort={handleSort}>
								Owner
							</SortableHead>
						)}
						<SortableHead field='positive' sort={sort} onSort={handleSort} align='right'>
							<ThumbsUp className='size-3.5 text-green-600 dark:text-green-500' strokeWidth={2.25} />
							Positive
						</SortableHead>
						<SortableHead field='negative' sort={sort} onSort={handleSort} align='right'>
							<ThumbsDown className='size-3.5 text-destructive' strokeWidth={2.25} />
							Negative
						</SortableHead>
						<SortableHead field='approval' sort={sort} onSort={handleSort}>
							Approval
						</SortableHead>
						<SortableHead field='lastFeedback' sort={sort} onSort={handleSort} align='right'>
							Last feedback
						</SortableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.length === 0 && (
						<TableRow className='hover:bg-transparent'>
							<TableCell colSpan={columnCount}>
								<Empty className='py-8'>{emptyLabel}</Empty>
							</TableCell>
						</TableRow>
					)}
					{rows.map((row) => {
						const isExpanded = expandedStoryId === row.storyId;
						return (
							<Fragment key={row.storyId}>
								<StoryFeedbackTableRow
									row={row}
									showOwner={showOwner}
									isExpanded={isExpanded}
									onToggle={() => toggleExpanded(row.storyId)}
								/>
								{isExpanded && (
									<TableRow className='bg-muted/30 hover:bg-muted/30'>
										<TableCell colSpan={columnCount} className='px-10 py-3'>
											<RecentVotes votes={row.votes} />
										</TableCell>
									</TableRow>
								)}
							</Fragment>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}

function SortableHead({
	field,
	sort,
	onSort,
	align = 'left',
	children,
}: {
	field: StoryFeedbackSortField;
	sort: StoryFeedbackSort;
	onSort: (field: StoryFeedbackSortField) => void;
	align?: 'left' | 'right';
	children: ReactNode;
}) {
	const isActive = sort.field === field;
	const DirectionIcon = sort.direction === 'asc' ? ArrowUp : ArrowDown;

	return (
		<TableHead className={cn('text-xs text-muted-foreground', align === 'right' && 'text-right')}>
			<button
				type='button'
				onClick={() => onSort(field)}
				className={cn(
					'inline-flex cursor-pointer items-center gap-1.5 hover:text-foreground',
					isActive && 'text-foreground',
				)}
			>
				{children}
				<DirectionIcon className={cn('size-3', !isActive && 'invisible')} />
			</button>
		</TableHead>
	);
}

function StoryFeedbackTableRow({
	row,
	showOwner,
	isExpanded,
	onToggle,
}: {
	row: StoryFeedbackRow;
	showOwner: boolean;
	isExpanded: boolean;
	onToggle: () => void;
}) {
	const VisibilityIcon = VISIBILITY_ICONS[row.visibility];
	const hasVotes = row.votes.length > 0;

	return (
		<TableRow
			className={cn(hasVotes && 'cursor-pointer', isExpanded && 'bg-muted/30')}
			onClick={hasVotes ? onToggle : undefined}
			aria-expanded={hasVotes ? isExpanded : undefined}
		>
			<TableCell className='pl-3 pr-0'>
				<ChevronRight
					className={cn(
						'size-3.5 text-muted-foreground transition-transform',
						isExpanded && 'rotate-90',
						!hasVotes && 'invisible',
					)}
				/>
			</TableCell>
			<TableCell className='max-w-80'>
				<div className='flex items-center gap-2'>
					<span className='truncate font-medium'>{row.title}</span>
					<Tooltip>
						<TooltipTrigger asChild>
							<VisibilityIcon className='size-3 shrink-0 text-muted-foreground' strokeWidth={2.25} />
						</TooltipTrigger>
						<TooltipContent>{STORY_FEEDBACK_VISIBILITY_LABELS[row.visibility]}</TooltipContent>
					</Tooltip>
					{row.needsAttention && (
						<span className='shrink-0 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-500'>
							Needs attention
						</span>
					)}
				</div>
			</TableCell>
			{showOwner && <TableCell className='text-muted-foreground'>{row.ownerName}</TableCell>}
			<TableCell className='text-right tabular-nums'>{row.positiveCount}</TableCell>
			<TableCell className='text-right tabular-nums'>{row.negativeCount}</TableCell>
			<TableCell>
				<ApprovalBar approvalRate={row.approvalRate} />
			</TableCell>
			<TableCell className='text-right text-muted-foreground'>
				{row.lastFeedbackAt ? <TimeAgoLabel date={row.lastFeedbackAt} /> : '—'}
			</TableCell>
		</TableRow>
	);
}

function ApprovalBar({ approvalRate }: { approvalRate: number | null }) {
	if (approvalRate === null) {
		return <span className='text-xs text-muted-foreground'>No feedback yet</span>;
	}

	return (
		<div className='flex items-center gap-2'>
			<div className='flex h-1.5 w-24 overflow-hidden rounded-full bg-destructive/30'>
				<div className='h-full bg-green-500' style={{ width: `${approvalRate * 100}%` }} />
			</div>
			<span className='w-8 text-xs tabular-nums text-muted-foreground'>{formatApprovalRate(approvalRate)}</span>
		</div>
	);
}

function RecentVotes({ votes }: { votes: StoryFeedbackVote[] }) {
	const recentVotes = votes.slice(0, RECENT_VOTES_LIMIT);
	const hiddenCount = votes.length - recentVotes.length;

	return (
		<div className='flex flex-col gap-2'>
			<span className='text-xs font-medium text-muted-foreground'>Latest feedback</span>
			<div className='grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2'>
				{recentVotes.map((vote) => (
					<RecentVote key={`${vote.voterName}-${vote.createdAt.getTime()}`} vote={vote} />
				))}
			</div>
			{hiddenCount > 0 && <span className='text-xs text-muted-foreground'>+ {hiddenCount} more</span>}
		</div>
	);
}

function RecentVote({ vote }: { vote: StoryFeedbackVote }) {
	const Icon = vote.value === 'up' ? ThumbsUp : ThumbsDown;

	return (
		<div className='flex items-center gap-2 text-xs'>
			<Icon
				className={cn(
					'size-3 shrink-0',
					vote.value === 'up' ? 'text-green-600 dark:text-green-500' : 'text-destructive',
				)}
				strokeWidth={2.25}
			/>
			<span className='truncate'>{vote.voterName}</span>
			<span className='ml-auto shrink-0 text-muted-foreground'>
				<TimeAgoLabel date={vote.createdAt} />
			</span>
		</div>
	);
}

function TimeAgoLabel({ date }: { date: Date }) {
	const timeAgo = useTimeAgo(date.getTime());
	return <span title={date.toLocaleString()}>{timeAgo.humanReadable}</span>;
}
