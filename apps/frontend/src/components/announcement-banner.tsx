import { ArrowUpRight, CircleAlert, Megaphone, PartyPopper, TriangleAlert, Users, X } from 'lucide-react';
import type { ComponentType } from 'react';

import type { Announcement, AnnouncementSeverity } from '@/lib/announcements';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAnnouncement } from '@/hooks/use-announcement';
import { getAudienceLabel } from '@/lib/announcements';
import { cn } from '@/lib/utils';

interface SeverityStyle {
	icon: ComponentType<{ className?: string }>;
	container: string;
	iconBadge: string;
	message: string;
	pill: string;
	action: string;
}

const severityStyles: Record<AnnouncementSeverity, SeverityStyle> = {
	info: {
		icon: Megaphone,
		container: 'border-primary/15 bg-primary/[0.06]',
		iconBadge: 'bg-primary/10 text-primary',
		message: 'text-muted-foreground',
		pill: 'border-primary/20 text-primary',
		action: 'text-primary hover:bg-primary/10',
	},
	success: {
		icon: PartyPopper,
		container: 'border-green-500/20 bg-green-500/[0.07]',
		iconBadge: 'bg-green-500/15 text-green-600 dark:text-green-400',
		message: 'text-muted-foreground',
		pill: 'border-green-500/25 text-green-700 dark:text-green-400',
		action: 'text-green-700 hover:bg-green-500/10 dark:text-green-400',
	},
	warning: {
		icon: TriangleAlert,
		container: 'border-amber-500/25 bg-amber-500/10',
		iconBadge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
		message: 'text-amber-900/70 dark:text-amber-200/70',
		pill: 'border-amber-500/30 text-amber-700 dark:text-amber-400',
		action: 'text-amber-800 hover:bg-amber-500/15 dark:text-amber-300',
	},
	critical: {
		icon: CircleAlert,
		container: 'border-destructive bg-destructive text-white',
		iconBadge: 'bg-white/20 text-white',
		message: 'text-white/80',
		pill: 'border-white/30 text-white',
		action: 'text-white hover:bg-white/15',
	},
};

export function AnnouncementBanner() {
	const { announcement, dismiss } = useAnnouncement();

	if (!announcement) {
		return null;
	}

	return <AnnouncementBannerView announcement={announcement} onDismiss={() => dismiss(announcement.id)} />;
}

function AnnouncementBannerView({ announcement, onDismiss }: { announcement: Announcement; onDismiss: () => void }) {
	const styles = severityStyles[announcement.severity];
	const Icon = styles.icon;
	const audienceLabel = getAudienceLabel(announcement.audience);

	return (
		<div
			role={announcement.severity === 'critical' ? 'alert' : 'status'}
			aria-live={announcement.severity === 'critical' ? 'assertive' : 'polite'}
			className={cn(
				'flex min-h-11 shrink-0 items-center gap-3 border-b px-4 py-1.5 text-sm animate-in fade-in slide-in-from-top-1 duration-300',
				styles.container,
			)}
		>
			<span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full', styles.iconBadge)}>
				<Icon className='size-3.5' />
			</span>

			<p className='min-w-0 flex-1 truncate'>
				<span className='font-medium'>{announcement.title}</span>
				{announcement.message && <span className={cn('ml-1.5', styles.message)}>{announcement.message}</span>}
			</p>

			{audienceLabel && (
				<Tooltip>
					<TooltipTrigger asChild>
						<span
							className={cn(
								'hidden shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium md:inline-flex',
								styles.pill,
							)}
						>
							<Users className='size-3' />
							{audienceLabel}
						</span>
					</TooltipTrigger>
					<TooltipContent>Shown to members of {audienceLabel}</TooltipContent>
				</Tooltip>
			)}

			{announcement.link && (
				<a
					href={announcement.link.href}
					target='_blank'
					rel='noopener noreferrer'
					className={cn(
						'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
						styles.action,
					)}
				>
					{announcement.link.label}
					<ArrowUpRight className='size-3.5' />
				</a>
			)}

			{announcement.dismissible && (
				<Button
					variant='ghost-no-hover'
					size='icon-xs'
					className={cn('shrink-0 text-current opacity-60 hover:opacity-100', styles.action)}
					onClick={onDismiss}
					aria-label='Dismiss announcement'
				>
					<X />
				</Button>
			)}
		</div>
	);
}
