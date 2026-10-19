export type AnnouncementTone = 'info' | 'warning';

export type AnnouncementAudience = { type: 'everyone' } | { type: 'groups'; groupNames: string[] };

export type Announcement = {
	id: string;
	title: string;
	body: string;
	tone: AnnouncementTone;
	audience: AnnouncementAudience;
	authorName: string;
	publishedAt: Date;
	callToAction?: { label: string; href: string };
};

export const MOCK_CURRENT_USER_GROUP_NAMES = ['Sales'];

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
	{
		id: 'sales-crm-v2-migration',
		title: 'Pipeline questions move to the new CRM model on Nov 3',
		body: 'Starting Monday Nov 3, pipeline and bookings questions will be answered from the new crm_v2 semantic model. Deals closed before Oct 1 may shift slightly because of the new attribution rules.\n\nPing #data-help if a number looks off.',
		tone: 'warning',
		audience: { type: 'groups', groupNames: ['Sales'] },
		authorName: 'Data team',
		publishedAt: new Date('2026-10-19T09:00:00Z'),
		callToAction: { label: 'Read migration notes', href: 'https://docs.getnao.io' },
	},
	{
		id: 'warehouse-maintenance',
		title: 'Warehouse maintenance on Saturday, 8–9am UTC',
		body: 'Queries will pause during the warehouse upgrade. Existing chats and stories stay available.',
		tone: 'info',
		audience: { type: 'everyone' },
		authorName: 'Platform team',
		publishedAt: new Date('2026-10-18T16:30:00Z'),
	},
	{
		id: 'finance-close',
		title: 'October close numbers are now final',
		body: 'The finance mart has been refreshed with the audited October figures.',
		tone: 'info',
		audience: { type: 'groups', groupNames: ['Finance'] },
		authorName: 'Finance ops',
		publishedAt: new Date('2026-10-17T12:00:00Z'),
	},
];

export function selectVisibleAnnouncements(
	announcements: Announcement[],
	userGroupNames: string[],
	dismissedIds: string[],
): Announcement[] {
	return announcements
		.filter((announcement) => !dismissedIds.includes(announcement.id))
		.filter((announcement) => isTargetingUser(announcement.audience, userGroupNames))
		.sort(compareByPriority);
}

export function formatAudienceLabel(audience: AnnouncementAudience): string {
	if (audience.type === 'everyone') {
		return 'Everyone';
	}
	return audience.groupNames.join(', ');
}

function isTargetingUser(audience: AnnouncementAudience, userGroupNames: string[]): boolean {
	if (audience.type === 'everyone') {
		return true;
	}
	return audience.groupNames.some((groupName) => userGroupNames.includes(groupName));
}

function compareByPriority(a: Announcement, b: Announcement): number {
	const toneDiff = toneRank(a.tone) - toneRank(b.tone);
	if (toneDiff !== 0) {
		return toneDiff;
	}
	return b.publishedAt.getTime() - a.publishedAt.getTime();
}

function toneRank(tone: AnnouncementTone): number {
	return tone === 'warning' ? 0 : 1;
}
