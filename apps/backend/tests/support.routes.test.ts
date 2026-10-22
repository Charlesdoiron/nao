import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	isEmailEnabled: vi.fn(),
	sendEmail: vi.fn(),
}));

vi.mock('../src/auth', () => ({ getSession: vi.fn() }));
vi.mock('../src/services/email', () => ({
	emailService: {
		isEnabled: mocks.isEmailEnabled,
		sendEmail: mocks.sendEmail,
	},
}));

import { supportRoutes } from '../src/trpc/support.routes';
import { router } from '../src/trpc/trpc';

const testRouter = router({ support: supportRoutes });

describe('support.submit', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.isEmailEnabled.mockReturnValue(true);
		mocks.sendEmail.mockResolvedValue(undefined);
	});

	it('emails the authenticated user’s request to support', async () => {
		await expect(createCaller().support.submit({ request: 'Help with <warehouse> setup' })).resolves.toEqual({
			success: true,
		});

		expect(mocks.sendEmail).toHaveBeenCalledWith(
			'support@getnao.io',
			expect.objectContaining({
				subject: 'Support request from Ada Lovelace',
				replyTo: 'ada@example.com',
				html: expect.stringContaining('Help with &lt;warehouse&gt; setup'),
			}),
			{ throwOnError: true },
		);
	});

	it('does not report success when email is unavailable', async () => {
		mocks.isEmailEnabled.mockReturnValue(false);

		await expect(createCaller().support.submit({ request: 'Please help' })).rejects.toMatchObject({
			code: 'PRECONDITION_FAILED',
		});
		expect(mocks.sendEmail).not.toHaveBeenCalled();
	});
});

function createCaller() {
	return testRouter.createCaller({
		session: {
			user: { id: 'user-id', name: 'Ada Lovelace', email: 'ada@example.com' },
			session: { token: 'session-token' },
		},
		selectedProjectId: null,
		selectedOrganizationId: null,
	} as never);
}
