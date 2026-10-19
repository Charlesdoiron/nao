import { useCallback, useMemo, useState } from 'react';

import type { Announcement } from '@/lib/announcements';
import { MOCK_ANNOUNCEMENTS, MOCK_VIEWER_GROUP_IDS, selectAnnouncement } from '@/lib/announcements';
import { createLocalStorage } from '@/lib/local-storage';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { usePermissions } from '@/hooks/use-permissions';

const dismissedAnnouncementsStorage = createLocalStorage<string[]>('nao-dismissed-announcements', []);

export function useAnnouncement() {
	const { role } = usePermissions();
	const [dismissedIds, setDismissedIds] = useLocalStorage(dismissedAnnouncementsStorage);
	const [previewId, setPreviewId] = useState(readPreviewId);

	const announcement = useMemo<Announcement | null>(() => {
		const preview = MOCK_ANNOUNCEMENTS.find((item) => item.id === previewId);
		if (preview) {
			return preview;
		}
		return selectAnnouncement(MOCK_ANNOUNCEMENTS, { role, groupIds: MOCK_VIEWER_GROUP_IDS }, dismissedIds);
	}, [previewId, role, dismissedIds]);

	const dismiss = useCallback(
		(id: string) => {
			setPreviewId(null);
			setDismissedIds((previous) => (previous.includes(id) ? previous : [...previous, id]));
		},
		[setDismissedIds],
	);

	return { announcement, dismiss };
}

function readPreviewId() {
	return new URLSearchParams(window.location.search).get('announcement');
}
