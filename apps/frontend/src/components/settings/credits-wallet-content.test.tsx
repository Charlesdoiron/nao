// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CreditsWalletContent } from './credits-wallet-content';

const mocks = vi.hoisted(() => ({
	getSummary: vi.fn(),
	listLedger: vi.fn(),
	listUsage: vi.fn(),
}));

vi.mock('@/main', () => ({
	trpc: {
		account: {
			getCreditSummary: {
				queryOptions: () => ({ queryKey: ['credit-summary'], queryFn: mocks.getSummary }),
			},
			listCreditLedger: {
				queryOptions: () => ({ queryKey: ['credit-ledger'], queryFn: mocks.listLedger }),
			},
			listManagedAiUsage: {
				queryOptions: () => ({ queryKey: ['managed-ai-usage'], queryFn: mocks.listUsage }),
			},
		},
	},
}));

describe('CreditsWalletContent', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('explains a non-admin contribution to the shared organization wallet', async () => {
		mocks.getSummary.mockResolvedValue({
			balanceMicroUsd: 0,
			lifetimeCreditedMicroUsd: 0,
			lifetimeDebitedMicroUsd: 0,
			enabled: true,
		});
		mocks.listLedger.mockResolvedValue({ groups: [], nextCursor: null });
		mocks.listUsage.mockResolvedValue({ runs: [], nextCursor: null });

		renderCreditsWalletContent(false);

		expect(await screen.findByText(/You gave your \$5 welcome credit/)).toBeTruthy();
		expect(screen.queryByText('Available')).toBeNull();
		expect(screen.queryByText('nao credit usage')).toBeNull();
	});

	it('shows organization wallet totals to admins', async () => {
		mocks.getSummary.mockResolvedValue({
			balanceMicroUsd: 5_000_000,
			lifetimeCreditedMicroUsd: 5_000_000,
			lifetimeDebitedMicroUsd: 0,
			enabled: true,
		});
		mocks.listLedger.mockResolvedValue({ groups: [], nextCursor: null });
		mocks.listUsage.mockResolvedValue({ runs: [], nextCursor: null });

		renderCreditsWalletContent(true);

		await screen.findByText('Available');
		expect(screen.queryByText(/You gave your \$5 welcome credit/)).toBeNull();
	});
});

function renderCreditsWalletContent(isAdmin: boolean) {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={queryClient}>
			<CreditsWalletContent isAdmin={isAdmin} />
		</QueryClientProvider>,
	);
}
