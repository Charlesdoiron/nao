import { useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';

const LAST_APP_HREF_KEY = 'nao:last-app-href';
const SETTINGS_PATH_PREFIX = '/settings';

/** Remembers the last visited page outside of settings so "Back to app" can return to it. */
export function useTrackLastAppHref() {
	const location = useRouterState({ select: (state) => state.location });

	useEffect(() => {
		if (!location.pathname.startsWith(SETTINGS_PATH_PREFIX)) {
			sessionStorage.setItem(LAST_APP_HREF_KEY, location.href);
		}
	}, [location.pathname, location.href]);
}

export function getLastAppHref() {
	return sessionStorage.getItem(LAST_APP_HREF_KEY) ?? '/';
}
