import { describe, expect, it } from 'vitest';

import { getAudienceLabel, selectAnnouncement } from './announcements';
import type { Announcement } from './announcements';

const now = new Date('2026-10-19T12:00:00Z');

describe('selectAnnouncement', () => {
	it('returns the highest severity announcement first', () => {
		const announcements = [
			createAnnouncement({ id: 'info', severity: 'info' }),
			createAnnouncement({ id: 'warning', severity: 'warning' }),
		];

		expect(selectAnnouncement(announcements, { groupIds: [] }, [], now)?.id).toBe('warning');
	});

	it('falls back to the next announcement once one is dismissed', () => {
		const announcements = [
			createAnnouncement({ id: 'info', severity: 'info' }),
			createAnnouncement({ id: 'warning', severity: 'warning' }),
		];

		expect(selectAnnouncement(announcements, { groupIds: [] }, ['warning'], now)?.id).toBe('info');
	});

	it('only targets members of the audience groups', () => {
		const announcements = [
			createAnnouncement({ audience: { type: 'groups', groups: [{ id: 'finance', name: 'Finance' }] } }),
		];

		expect(selectAnnouncement(announcements, { groupIds: ['sales'] }, [], now)).toBeNull();
		expect(selectAnnouncement(announcements, { groupIds: ['finance'] }, [], now)).not.toBeNull();
	});

	it('only targets viewers with a matching role', () => {
		const announcements = [createAnnouncement({ audience: { type: 'roles', roles: ['admin'] } })];

		expect(selectAnnouncement(announcements, { role: 'viewer', groupIds: [] }, [], now)).toBeNull();
		expect(selectAnnouncement(announcements, { role: 'admin', groupIds: [] }, [], now)).not.toBeNull();
	});

	it('ignores announcements outside of their schedule', () => {
		const announcements = [
			createAnnouncement({ id: 'ended', endsAt: '2026-10-01T00:00:00Z' }),
			createAnnouncement({ id: 'upcoming', startsAt: '2026-11-01T00:00:00Z' }),
		];

		expect(selectAnnouncement(announcements, { groupIds: [] }, [], now)).toBeNull();
	});
});

describe('getAudienceLabel', () => {
	it('labels group audiences only', () => {
		expect(getAudienceLabel({ type: 'everyone' })).toBeNull();
		expect(
			getAudienceLabel({
				type: 'groups',
				groups: [
					{ id: 'finance', name: 'Finance' },
					{ id: 'ops', name: 'Ops' },
				],
			}),
		).toBe('Finance, Ops');
	});
});

function createAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
	return {
		id: 'announcement',
		severity: 'info',
		title: 'Title',
		audience: { type: 'everyone' },
		dismissible: true,
		...overrides,
	};
}
