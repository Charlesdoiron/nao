import { useCallback, useMemo } from 'react';

import { useLocalStorage } from '@/hooks/use-local-storage';
import { MOCK_ANNOUNCEMENTS, MOCK_CURRENT_USER_GROUP_NAMES, selectVisibleAnnouncements } from '@/lib/announcements';
import { createLocalStorage } from '@/lib/local-storage';

const dismissedStorage = createLocalStorage<string[]>('nao-announcement-dismissed', []);
const seenStorage = createLocalStorage<string[]>('nao-announcement-seen', []);

export function useHeaderAnnouncements() {
	const [dismissedIds, setDismissedIds] = useLocalStorage(dismissedStorage);
	const [seenIds, setSeenIds] = useLocalStorage(seenStorage);

	const announcements = useMemo(
		() => selectVisibleAnnouncements(MOCK_ANNOUNCEMENTS, MOCK_CURRENT_USER_GROUP_NAMES, dismissedIds),
		[dismissedIds],
	);
	const hasUnseen = announcements.some((announcement) => !seenIds.includes(announcement.id));

	const dismiss = useCallback(
		(announcementId: string) => {
			setDismissedIds((previous) => [...previous, announcementId]);
		},
		[setDismissedIds],
	);

	const markAllSeen = useCallback(() => {
		setSeenIds((previous) => [...new Set([...previous, ...announcements.map((announcement) => announcement.id)])]);
	}, [announcements, setSeenIds]);

	return { announcements, hasUnseen, dismiss, markAllSeen };
}
