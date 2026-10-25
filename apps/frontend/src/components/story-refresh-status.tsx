import { CalendarClock, CircleAlert, CircleCheck, CircleX, MessageSquare, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { StoryRefreshQueryStatus, StoryRefreshRunStatus, StoryRefreshTrigger } from '@/lib/story-refresh-history';
import { REFRESH_STATUS_LABELS, REFRESH_TRIGGER_LABELS } from '@/lib/story-refresh-history';
import { cn } from '@/lib/utils';

const STATUS_ICONS: Record<StoryRefreshRunStatus, LucideIcon> = {
	success: CircleCheck,
	partial: CircleAlert,
	failed: CircleX,
};

const STATUS_TEXT_CLASSES: Record<StoryRefreshRunStatus, string> = {
	success: 'text-green-600 dark:text-green-500',
	partial: 'text-amber-600 dark:text-amber-500',
	failed: 'text-destructive',
};

const STATUS_BADGE_CLASSES: Record<StoryRefreshRunStatus, string> = {
	success: 'bg-green-500/10 text-green-700 dark:text-green-500',
	partial: 'bg-amber-500/10 text-amber-700 dark:text-amber-500',
	failed: 'bg-destructive/10 text-destructive',
};

export const STATUS_BAR_CLASSES: Record<StoryRefreshRunStatus, string> = {
	success: 'bg-green-500/70',
	partial: 'bg-amber-500',
	failed: 'bg-destructive',
};

const TRIGGER_ICONS: Record<StoryRefreshTrigger, LucideIcon> = {
	schedule: CalendarClock,
	manual: RefreshCw,
	chat: MessageSquare,
};

export function RefreshStatusIcon({
	status,
	className,
}: {
	status: StoryRefreshRunStatus | StoryRefreshQueryStatus;
	className?: string;
}) {
	const Icon = STATUS_ICONS[status];
	return <Icon className={cn('size-3.5 shrink-0', STATUS_TEXT_CLASSES[status], className)} strokeWidth={2.25} />;
}

export function RefreshStatusBadge({ status, className }: { status: StoryRefreshRunStatus; className?: string }) {
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
				STATUS_BADGE_CLASSES[status],
				className,
			)}
		>
			<RefreshStatusIcon status={status} className='size-3 text-current' />
			{REFRESH_STATUS_LABELS[status]}
		</span>
	);
}

export function RefreshTriggerLabel({ trigger, className }: { trigger: StoryRefreshTrigger; className?: string }) {
	const Icon = TRIGGER_ICONS[trigger];
	return (
		<span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
			<Icon className='size-3.5 shrink-0 text-muted-foreground' strokeWidth={2.25} />
			{REFRESH_TRIGGER_LABELS[trigger]}
		</span>
	);
}
