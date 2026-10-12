// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ManagedWelcomeGrantProvider, useManagedWelcomeGrant } from './managed-welcome-grant-dialog';

const mocks = vi.hoisted(() => ({
	getStatus: vi.fn(),
	claimGrant: vi.fn(),
}));

vi.mock('@/main', () => ({
	trpc: {
		account: {
			getManagedCreditStatus: {
				queryKey: () => ['managed-credit-status'],
				queryOptions: () => ({
					queryKey: ['managed-credit-status'],
					queryFn: mocks.getStatus,
				}),
			},
			claimWelcomeGrant: {
				mutationOptions: () => ({ mutationFn: mocks.claimGrant }),
			},
			getCreditSummary: {
				queryKey: () => ['credit-summary'],
			},
		},
		project: {
			listAvailableTranscribeModels: {
				queryKey: () => ['available-models'],
			},
		},
	},
}));

function SendHarness({ onDecision }: { onDecision: (decision: string) => void }) {
	const { confirmBeforeSend } = useManagedWelcomeGrant();

	return <button onClick={() => void confirmBeforeSend('nao').then(onDecision)}>Send</button>;
}

describe('ManagedWelcomeGrantProvider', () => {
	beforeEach(() => {
		mocks.getStatus.mockResolvedValue({
			enabled: true,
			organization: { id: 'org-1', name: 'Acme' },
			welcomeGrantStatus: 'unclaimed',
			balanceMicroUsd: 0,
		});
		mocks.claimGrant.mockResolvedValue({
			enabled: true,
			organization: { id: 'org-1', name: 'Acme' },
			welcomeGrantStatus: 'claimed_here',
			balanceMicroUsd: 5_000_000,
		});
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('waits for explicit confirmation before allowing the managed send', async () => {
		const onDecision = vi.fn();
		renderProvider(<SendHarness onDecision={onDecision} />);

		fireEvent.click(screen.getByRole('button', { name: 'Send' }));
		expect((await screen.findByRole('dialog')).textContent).toContain('Acme');
		expect(onDecision).not.toHaveBeenCalled();
		expect(mocks.claimGrant).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole('button', { name: 'Apply $5 and send' }));

		await waitFor(() => expect(mocks.claimGrant).toHaveBeenCalledOnce());
		await waitFor(() => expect(onDecision).toHaveBeenCalledWith('send'));
	});

	it('does not claim or send when the user chooses another project', async () => {
		const onDecision = vi.fn();
		renderProvider(<SendHarness onDecision={onDecision} />);

		fireEvent.click(screen.getByRole('button', { name: 'Send' }));
		fireEvent.click(await screen.findByRole('button', { name: 'Switch project' }));

		await waitFor(() => expect(onDecision).toHaveBeenCalledWith('switch-project'));
		expect(mocks.claimGrant).not.toHaveBeenCalled();
	});

	it('shares one confirmation between concurrent managed sends', async () => {
		const onDecision = vi.fn();
		let releaseStatus = () => {};
		mocks.getStatus.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					releaseStatus = () =>
						resolve({
							enabled: true,
							organization: { id: 'org-1', name: 'Acme' },
							welcomeGrantStatus: 'unclaimed',
							balanceMicroUsd: 0,
						});
				}),
		);
		renderProvider(<SendHarness onDecision={onDecision} />);

		const sendButton = screen.getByRole('button', { name: 'Send' });
		fireEvent.click(sendButton);
		fireEvent.click(sendButton);
		await act(async () => releaseStatus());
		fireEvent.click(await screen.findByRole('button', { name: 'Apply $5 and send' }));

		await waitFor(() => expect(onDecision).toHaveBeenCalledTimes(2));
		expect(onDecision).toHaveBeenNthCalledWith(1, 'send');
		expect(onDecision).toHaveBeenNthCalledWith(2, 'send');
		expect(mocks.claimGrant).toHaveBeenCalledOnce();
	});
});

function renderProvider(children: React.ReactNode) {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={queryClient}>
			<ManagedWelcomeGrantProvider>{children}</ManagedWelcomeGrantProvider>
		</QueryClientProvider>,
	);
}
