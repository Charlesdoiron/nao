import type { UserRole } from '@nao/shared/types';

export type AnnouncementSeverity = 'info' | 'success' | 'warning' | 'critical';

export type AnnouncementAudience =
	| { type: 'everyone' }
	| { type: 'roles'; roles: UserRole[] }
	| { type: 'groups'; groups: { id: string; name: string }[] };

export interface Announcement {
	id: string;
	severity: AnnouncementSeverity;
	title: string;
	message?: string;
	audience: AnnouncementAudience;
	link?: { label: string; href: string };
	dismissible: boolean;
	startsAt?: string;
	endsAt?: string;
}

export interface AnnouncementViewer {
	role?: UserRole;
	groupIds: string[];
}

const SEVERITY_PRIORITY: Record<AnnouncementSeverity, number> = {
	critical: 3,
	warning: 2,
	info: 1,
	success: 0,
};

export const MOCK_VIEWER_GROUP_IDS = ['finance'];

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
	{
		id: 'warehouse-incident-2026-10',
		severity: 'critical',
		title: 'Warehouse queries are delayed.',
		message: 'We are investigating slow responses from Snowflake. Answers may take longer than usual.',
		audience: { type: 'everyone' },
		link: { label: 'Incident details', href: 'https://status.getnao.io' },
		dismissible: false,
		endsAt: '2026-10-01T00:00:00Z',
	},
	{
		id: 'maintenance-2026-10-24',
		severity: 'warning',
		title: 'Scheduled maintenance on Saturday, Oct 24 from 6:00 to 8:00 UTC.',
		message: 'Chats and stories will be read-only during the upgrade.',
		audience: { type: 'everyone' },
		link: { label: 'View status page', href: 'https://status.getnao.io' },
		dismissible: true,
	},
	{
		id: 'finance-q3-context',
		severity: 'info',
		title: 'The Q3 revenue model is now in your context.',
		message: 'Ask about ARR, churn and net retention by segment.',
		audience: { type: 'groups', groups: [{ id: 'finance', name: 'Finance' }] },
		link: { label: 'Read the guide', href: 'https://docs.getnao.io' },
		dismissible: true,
	},
	{
		id: 'stories-external-sharing',
		severity: 'success',
		title: 'Stories can now be shared with external viewers.',
		message: 'Open any story and use Share to send a read-only link.',
		audience: { type: 'roles', roles: ['admin', 'user', 'context_admin'] },
		dismissible: true,
	},
];

export function selectAnnouncement(
	announcements: Announcement[],
	viewer: AnnouncementViewer,
	dismissedIds: string[],
	now = new Date(),
): Announcement | null {
	const visible = announcements.filter(
		(announcement) =>
			!dismissedIds.includes(announcement.id) &&
			isWithinSchedule(announcement, now) &&
			isTargetedAt(announcement.audience, viewer),
	);
	const [highestPriority] = visible.sort((a, b) => SEVERITY_PRIORITY[b.severity] - SEVERITY_PRIORITY[a.severity]);
	return highestPriority ?? null;
}

export function getAudienceLabel(audience: AnnouncementAudience): string | null {
	if (audience.type === 'groups') {
		return audience.groups.map((group) => group.name).join(', ');
	}
	return null;
}

function isWithinSchedule(announcement: Announcement, now: Date) {
	const hasStarted = !announcement.startsAt || new Date(announcement.startsAt) <= now;
	const hasEnded = !!announcement.endsAt && new Date(announcement.endsAt) <= now;
	return hasStarted && !hasEnded;
}

function isTargetedAt(audience: AnnouncementAudience, viewer: AnnouncementViewer) {
	switch (audience.type) {
		case 'everyone':
			return true;
		case 'roles':
			return !!viewer.role && audience.roles.includes(viewer.role);
		case 'groups':
			return audience.groups.some((group) => viewer.groupIds.includes(group.id));
	}
}
