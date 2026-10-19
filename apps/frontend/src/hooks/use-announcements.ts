import { useCallback, useMemo, useState } from 'react';

import type { Announcement } from '@/lib/announcements';
import { isAnnouncementForUser, MOCK_ANNOUNCEMENTS, MOCK_CURRENT_USER_GROUPS } from '@/lib/announcements';
import { useSession } from '@/lib/auth-client';

/**
 * Returns the announcements targeted at the current user that they have not dismissed yet.
 * Dismissals are remembered per user and per announcement in localStorage.
 */
export function useAnnouncements() {
	const { data: session } = useSession();
	const userId = session?.user?.id;
	const storageKey = userId ? `announcements-dismissed:${userId}` : null;
	const [dismissedIds, setDismissedIds] = useState<string[]>(() => readDismissedIds(storageKey));
	const [loadedKey, setLoadedKey] = useState(storageKey);

	if (loadedKey !== storageKey) {
		setLoadedKey(storageKey);
		setDismissedIds(readDismissedIds(storageKey));
	}

	const announcements = useMemo<Announcement[]>(() => {
		if (!storageKey) {
			return [];
		}
		return MOCK_ANNOUNCEMENTS.filter(
			(announcement) =>
				isAnnouncementForUser(announcement, MOCK_CURRENT_USER_GROUPS) &&
				!dismissedIds.includes(announcement.id),
		).sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
	}, [storageKey, dismissedIds]);

	const dismiss = useCallback(
		(announcementId: string) => {
			setDismissedIds((previous) => {
				const next = [...new Set([...previous, announcementId])];
				writeDismissedIds(storageKey, next);
				return next;
			});
		},
		[storageKey],
	);

	return { announcements, dismiss };
}

function readDismissedIds(storageKey: string | null): string[] {
	if (!storageKey) {
		return [];
	}
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
		return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
	} catch {
		return [];
	}
}

function writeDismissedIds(storageKey: string | null, ids: string[]) {
	if (!storageKey) {
		return;
	}
	try {
		localStorage.setItem(storageKey, JSON.stringify(ids));
	} catch {
		// Ignore quota / availability errors
	}
}
