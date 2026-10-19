import { useParams } from '@tanstack/react-router';
import { ArrowUpRight, ChevronLeft, ChevronRight, Megaphone, Minus, Sparkles, Users, Wrench, X } from 'lucide-react';
import { useState } from 'react';
import { Streamdown } from 'streamdown';
import type { ComponentType } from 'react';

import type { Announcement, AnnouncementTone } from '@/lib/announcements';
import { Button } from '@/components/ui/button';
import { useAnnouncements } from '@/hooks/use-announcements';
import { getAudienceLabel } from '@/lib/announcements';
import { cn } from '@/lib/utils';

/**
 * Floats over the bottom-right of the main column. On chat pages the composer is docked at the bottom,
 * so the banner lifts above it and starts minimized to keep the conversation readable.
 */
export function AnnouncementBanner() {
	const { announcements, dismiss } = useAnnouncements();
	const isComposerDocked = useParams({ strict: false, select: (params) => Boolean(params.chatId) });
	const [index, setIndex] = useState(0);
	const [minimizedOverride, setMinimizedOverride] = useState<boolean | null>(null);
	const isMinimized = minimizedOverride ?? isComposerDocked;
	const currentIndex = Math.min(index, announcements.length - 1);
	const announcement = announcements[currentIndex];

	if (!announcement) {
		return null;
	}

	return (
		<div
			className={cn(
				'pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-end p-4 max-md:hidden',
				isComposerDocked && 'pb-36',
			)}
		>
			{isMinimized ? (
				<AnnouncementPill
					announcement={announcement}
					total={announcements.length}
					onExpand={() => setMinimizedOverride(false)}
				/>
			) : (
				<section
					key={announcement.id}
					role='status'
					aria-live='polite'
					aria-label='Announcement'
					className={cn(
						'pointer-events-auto relative w-[22rem] overflow-hidden rounded-xl border bg-background/95 shadow-lg backdrop-blur',
						'animate-in fade-in slide-in-from-bottom-2 duration-300',
					)}
				>
					<div className={cn('absolute inset-y-0 left-0 w-1', toneStyles[announcement.tone].accent)} />
					<AnnouncementContent
						announcement={announcement}
						onDismiss={() => dismiss(announcement.id)}
						onMinimize={() => setMinimizedOverride(true)}
					/>
					{announcements.length > 1 && (
						<AnnouncementPager
							current={currentIndex}
							total={announcements.length}
							onPrevious={() => setIndex(currentIndex - 1)}
							onNext={() => setIndex(currentIndex + 1)}
						/>
					)}
				</section>
			)}
		</div>
	);
}

function AnnouncementPill({
	announcement,
	total,
	onExpand,
}: {
	announcement: Announcement;
	total: number;
	onExpand: () => void;
}) {
	const tone = toneStyles[announcement.tone];
	const Icon = tone.icon;

	return (
		<button
			type='button'
			onClick={onExpand}
			aria-label='Show announcements'
			className={cn(
				'pointer-events-auto flex max-w-48 cursor-pointer items-center gap-2 rounded-full border bg-background/95 py-1.5 pl-1.5 pr-3 shadow-md backdrop-blur',
				'animate-in fade-in slide-in-from-bottom-2 duration-300 transition-colors hover:bg-accent',
			)}
		>
			<span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full', tone.iconContainer)}>
				<Icon className='size-3.5' />
			</span>
			<span className='truncate text-xs font-medium text-foreground'>
				{total > 1 ? `${total} announcements` : announcement.title}
			</span>
			<span className={cn('size-1.5 shrink-0 rounded-full', tone.accent)} />
		</button>
	);
}

function AnnouncementContent({
	announcement,
	onDismiss,
	onMinimize,
}: {
	announcement: Announcement;
	onDismiss: () => void;
	onMinimize: () => void;
}) {
	const tone = toneStyles[announcement.tone];
	const Icon = tone.icon;

	return (
		<div className='flex gap-3 py-3.5 pl-5 pr-3'>
			<div className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', tone.iconContainer)}>
				<Icon className='size-4' />
			</div>
			<div className='min-w-0 flex-1'>
				<div className='flex items-start gap-2'>
					<div className='min-w-0 flex-1'>
						<AudienceLabel announcement={announcement} />
						<h2 className='mt-0.5 text-sm font-medium leading-snug text-foreground'>
							{announcement.title}
						</h2>
					</div>
					<div className='-mr-1 -mt-0.5 flex items-center'>
						<Button
							variant='ghost-muted'
							size='icon-xs'
							onClick={onMinimize}
							aria-label='Minimize announcements'
						>
							<Minus />
						</Button>
						<Button
							variant='ghost-muted'
							size='icon-xs'
							onClick={onDismiss}
							aria-label='Dismiss announcement'
						>
							<X />
						</Button>
					</div>
				</div>
				<div className='mt-1 text-xs leading-relaxed text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_p]:m-0 [&_strong]:font-medium [&_strong]:text-foreground'>
					<Streamdown mode='static'>{announcement.body}</Streamdown>
				</div>
				{announcement.action && (
					<div className='mt-3 flex items-center gap-1'>
						<Button size='sm' asChild>
							<a href={announcement.action.href} {...getExternalLinkProps(announcement.action.href)}>
								{announcement.action.label}
								{isExternalLink(announcement.action.href) && <ArrowUpRight />}
							</a>
						</Button>
						<Button size='sm' variant='ghost-muted' onClick={onDismiss}>
							Got it
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}

function AudienceLabel({ announcement }: { announcement: Announcement }) {
	const isGroup = announcement.audience.type === 'group';

	return (
		<div className='flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
			<span className={toneStyles[announcement.tone].label}>{toneStyles[announcement.tone].name}</span>
			<span aria-hidden>·</span>
			<span className='flex items-center gap-1'>
				{isGroup && <Users className='size-3' />}
				{getAudienceLabel(announcement.audience)}
			</span>
		</div>
	);
}

function AnnouncementPager({
	current,
	total,
	onPrevious,
	onNext,
}: {
	current: number;
	total: number;
	onPrevious: () => void;
	onNext: () => void;
}) {
	return (
		<div className='flex items-center justify-between border-t bg-muted/30 py-1 pl-5 pr-2 text-xs text-muted-foreground'>
			<span>
				{current + 1} of {total} announcements
			</span>
			<div className='flex items-center'>
				<Button
					variant='ghost-muted'
					size='icon-xs'
					onClick={onPrevious}
					disabled={current === 0}
					aria-label='Previous announcement'
				>
					<ChevronLeft />
				</Button>
				<Button
					variant='ghost-muted'
					size='icon-xs'
					onClick={onNext}
					disabled={current === total - 1}
					aria-label='Next announcement'
				>
					<ChevronRight />
				</Button>
			</div>
		</div>
	);
}

function isExternalLink(href: string): boolean {
	return /^https?:\/\//.test(href);
}

function getExternalLinkProps(href: string) {
	return isExternalLink(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {};
}

const toneStyles: Record<
	AnnouncementTone,
	{ name: string; icon: ComponentType<{ className?: string }>; accent: string; iconContainer: string; label: string }
> = {
	info: {
		name: 'Update',
		icon: Megaphone,
		accent: 'bg-primary',
		iconContainer: 'bg-primary/10 text-primary',
		label: 'text-primary',
	},
	feature: {
		name: 'New',
		icon: Sparkles,
		accent: 'bg-violet',
		iconContainer: 'bg-violet/10 text-violet',
		label: 'text-violet',
	},
	maintenance: {
		name: 'Maintenance',
		icon: Wrench,
		accent: 'bg-amber-500',
		iconContainer: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
		label: 'text-amber-600 dark:text-amber-400',
	},
};
