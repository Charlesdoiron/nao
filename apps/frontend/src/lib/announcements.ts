export type AnnouncementTone = 'info' | 'feature' | 'maintenance';

export type AnnouncementAudience = { type: 'everyone' } | { type: 'group'; groupName: string };

export interface AnnouncementAction {
	label: string;
	href: string;
}

export interface Announcement {
	id: string;
	tone: AnnouncementTone;
	audience: AnnouncementAudience;
	title: string;
	body: string;
	action?: AnnouncementAction;
	publishedAt: Date;
}

export const MOCK_CURRENT_USER_GROUPS = ['Finance'];

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
	{
		id: 'q3-revenue-semantic-layer',
		tone: 'feature',
		audience: { type: 'group', groupName: 'Finance' },
		title: 'New revenue metrics are live',
		body: 'Ask about **net revenue retention** and **ARR by segment** — they now use the certified finance definitions. See the `revenue` model for details.',
		action: { label: 'Try a question', href: '/?example=true' },
		publishedAt: new Date('2026-10-18T09:00:00Z'),
	},
	{
		id: 'warehouse-maintenance-oct-24',
		tone: 'maintenance',
		audience: { type: 'everyone' },
		title: 'Scheduled warehouse maintenance',
		body: 'Queries may be slower on **Saturday, Oct 24 from 02:00 to 04:00 UTC** while we upgrade the warehouse.',
		action: { label: 'Read the status page', href: 'https://status.getnao.io' },
		publishedAt: new Date('2026-10-17T15:30:00Z'),
	},
	{
		id: 'sales-dashboard-retired',
		tone: 'info',
		audience: { type: 'group', groupName: 'Sales' },
		title: 'Legacy pipeline dashboard retired',
		body: 'Use the **Pipeline overview** story instead.',
		publishedAt: new Date('2026-10-12T10:00:00Z'),
	},
];

export function isAnnouncementForUser(announcement: Announcement, userGroups: string[]): boolean {
	if (announcement.audience.type === 'everyone') {
		return true;
	}
	return userGroups.includes(announcement.audience.groupName);
}

export function getAudienceLabel(audience: AnnouncementAudience): string {
	return audience.type === 'everyone' ? 'Everyone' : `${audience.groupName} team`;
}
