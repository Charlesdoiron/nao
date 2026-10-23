import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireOrganizationAdminCloud, requireUsageAdminAccess } from './route-guards';

const mocks = vi.hoisted(() => ({
	ensureQueryData: vi.fn(),
}));

vi.mock('@/main', () => ({
	queryClient: {
		ensureQueryData: mocks.ensureQueryData,
	},
	trpc: {
		organization: {
			get: {
				queryOptions: () => ({}),
			},
		},
		project: {
			getCurrent: {
				queryOptions: () => ({}),
			},
		},
		system: {
			getPublicConfig: {
				queryOptions: () => ({}),
			},
		},
	},
}));

describe('requireUsageAdminAccess', () => {
	beforeEach(() => {
		mocks.ensureQueryData.mockReset();
	});

	it.each(['admin', 'context_admin'])('allows a project %s without organization membership', async (userRole) => {
		mocks.ensureQueryData
			.mockResolvedValueOnce({ userRole })
			.mockResolvedValueOnce({ naoMode: 'cloud' })
			.mockRejectedValueOnce(new Error('organization not found'));

		await expect(requireUsageAdminAccess()).resolves.toBeUndefined();
		expect(mocks.ensureQueryData).toHaveBeenCalledTimes(2);
	});

	it('redirects a regular project user', async () => {
		mocks.ensureQueryData
			.mockResolvedValueOnce({ userRole: 'user' })
			.mockResolvedValueOnce({ naoMode: 'self-hosted' });

		await expect(requireUsageAdminAccess()).rejects.toBeDefined();
		expect(mocks.ensureQueryData).toHaveBeenCalledTimes(2);
	});
});

describe('requireOrganizationAdminCloud', () => {
	beforeEach(() => {
		mocks.ensureQueryData.mockReset();
	});

	it('allows a cloud organization admin when billing is disabled', async () => {
		const config = { naoMode: 'cloud', cloudBillingEnabled: false };
		mocks.ensureQueryData.mockResolvedValueOnce(config).mockResolvedValueOnce({ role: 'admin' });

		await expect(requireOrganizationAdminCloud()).resolves.toBe(config);
	});
});
