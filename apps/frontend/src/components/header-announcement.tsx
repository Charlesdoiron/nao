import { useState } from 'react';
import { ArrowUpRight, ChevronDown, Megaphone, Users } from 'lucide-react';

import type { Announcement, AnnouncementTone } from '@/lib/announcements';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useHeaderAnnouncements } from '@/hooks/use-header-announcements';
import { formatAudienceLabel } from '@/lib/announcements';
import { cn } from '@/lib/utils';

const TONE_STYLES: Record<AnnouncementTone, { pill: string; accent: string; dot: string }> = {
	info: {
		pill: 'border-primary/20 bg-primary/5 hover:bg-primary/10 data-[state=open]:bg-primary/10',
		accent: 'text-primary',
		dot: 'bg-primary',
	},
	warning: {
		pill: 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 data-[state=open]:bg-amber-500/15',
		accent: 'text-amber-700 dark:text-amber-400',
		dot: 'bg-amber-500',
	},
};

export function HeaderAnnouncement({ className }: { className?: string }) {
	const { announcements, hasUnseen, dismiss, markAllSeen } = useHeaderAnnouncements();
	const [isOpen, setIsOpen] = useState(false);
	const featured = announcements.at(0);

	if (!featured) {
		return null;
	}

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (open) {
			markAllSeen();
		}
	};

	return (
		<Popover open={isOpen} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<AnnouncementPill
					announcement={featured}
					otherCount={announcements.length - 1}
					hasUnseen={hasUnseen}
					className={className}
				/>
			</PopoverTrigger>
			<PopoverContent align='center' sideOffset={8} className='w-[400px] p-0 overflow-hidden'>
				<div className='flex items-center justify-between border-b px-4 py-2'>
					<span className='text-xs font-medium text-foreground'>Announcements</span>
					<span className='text-[11px] text-muted-foreground'>{announcements.length} for you</span>
				</div>
				<div className='max-h-[60vh] overflow-y-auto'>
					{announcements.map((announcement) => (
						<AnnouncementDetails
							key={announcement.id}
							announcement={announcement}
							onDismiss={() => dismiss(announcement.id)}
						/>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}

function AnnouncementPill({
	announcement,
	otherCount,
	hasUnseen,
	className,
	...props
}: React.ComponentProps<'button'> & { announcement: Announcement; otherCount: number; hasUnseen: boolean }) {
	const tone = TONE_STYLES[announcement.tone];

	return (
		<button
			{...props}
			type='button'
			data-slot='header-announcement-trigger'
			aria-label={`Announcement: ${announcement.title}`}
			className={cn(
				'group/announcement flex h-7 min-w-0 max-w-md items-center gap-2 rounded-full border px-2.5 text-xs transition-colors cursor-pointer',
				tone.pill,
				className,
			)}
		>
			<span className='relative shrink-0'>
				<Megaphone className={cn('size-3.5', tone.accent)} />
				{hasUnseen && (
					<span
						className={cn('absolute -top-0.5 -right-0.5 size-1.5 rounded-full animate-pulse', tone.dot)}
					/>
				)}
			</span>
			<span className={cn('shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em]', tone.accent)}>
				{formatAudienceLabel(announcement.audience)}
			</span>
			<span className='truncate text-foreground'>{announcement.title}</span>
			{otherCount > 0 && (
				<span className='shrink-0 rounded-full bg-background/80 px-1.5 text-[10px] font-medium text-muted-foreground'>
					+{otherCount}
				</span>
			)}
			<ChevronDown className='size-3 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/announcement:rotate-180' />
		</button>
	);
}

function AnnouncementDetails({ announcement, onDismiss }: { announcement: Announcement; onDismiss: () => void }) {
	const tone = TONE_STYLES[announcement.tone];

	return (
		<article className='flex flex-col gap-2 border-b px-4 py-3 last:border-b-0'>
			<div className='flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]'>
				<span className={cn('size-1.5 rounded-full', tone.dot)} />
				<Users className={cn('size-3', tone.accent)} />
				<span className={tone.accent}>{formatAudienceLabel(announcement.audience)}</span>
				<span className='text-muted-foreground'>· {formatPublishedDate(announcement.publishedAt)}</span>
			</div>
			<p className='text-sm font-medium leading-snug text-foreground'>{announcement.title}</p>
			<p className='whitespace-pre-line text-xs leading-relaxed text-muted-foreground'>{announcement.body}</p>
			<div className='flex items-center justify-between gap-2 pt-1'>
				<span className='truncate text-[11px] text-muted-foreground'>Posted by {announcement.authorName}</span>
				<div className='flex shrink-0 items-center gap-1'>
					<Button
						variant='ghost-muted'
						size='sm'
						className='text-xs'
						onClick={onDismiss}
						data-slot='header-announcement-dismiss'
					>
						Dismiss
					</Button>
					{announcement.callToAction && (
						<Button size='sm' className='rounded-full text-xs' asChild>
							<a href={announcement.callToAction.href} target='_blank' rel='noreferrer'>
								{announcement.callToAction.label}
								<ArrowUpRight className='size-3' />
							</a>
						</Button>
					)}
				</div>
			</div>
		</article>
	);
}

function formatPublishedDate(date: Date): string {
	return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
