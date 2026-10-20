import type { UserGroupFeature } from '@nao/shared';
import type { UserRole } from '@nao/shared/types';

export const USER_SETTINGS_PAGES = ['/settings', '/settings/account', '/settings/memory'];

/**
 * Admins and context admins always see advanced settings; users need a group granting them.
 * Without a project role (e.g. projectless cloud organizations) the organization pages stay reachable.
 */
export function hasAdvancedSettingsAccess(
	role: UserRole | undefined,
	features: Partial<Record<UserGroupFeature, boolean>> | undefined,
): boolean {
	if (role === undefined || role === 'admin' || role === 'context_admin') {
		return true;
	}
	return role === 'user' && features?.advancedSettings === true;
}

export function isUserSettingsPage(pathname: string): boolean {
	return USER_SETTINGS_PAGES.includes(pathname.replace(/\/+$/, ''));
}
