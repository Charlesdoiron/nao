import { describe, expect, it } from 'vitest';

import { hasAdvancedSettingsAccess, isUserSettingsPage } from './advanced-settings-access';

describe('hasAdvancedSettingsAccess', () => {
	it('always grants admins and context admins', () => {
		expect(hasAdvancedSettingsAccess('admin', { advancedSettings: false })).toBe(true);
		expect(hasAdvancedSettingsAccess('context_admin', undefined)).toBe(true);
	});

	it('grants users only when one of their groups allows it', () => {
		expect(hasAdvancedSettingsAccess('user', { advancedSettings: true })).toBe(true);
		expect(hasAdvancedSettingsAccess('user', { advancedSettings: false })).toBe(false);
		expect(hasAdvancedSettingsAccess('user', undefined)).toBe(false);
	});

	it('never grants viewers', () => {
		expect(hasAdvancedSettingsAccess('viewer', { advancedSettings: true })).toBe(false);
	});
});

describe('isUserSettingsPage', () => {
	it('matches the user section pages only', () => {
		expect(isUserSettingsPage('/settings/account')).toBe(true);
		expect(isUserSettingsPage('/settings/account/')).toBe(true);
		expect(isUserSettingsPage('/settings/project/user-groups')).toBe(false);
	});
});
