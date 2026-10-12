// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CreditsAiUsage } from './credits-ai-usage';

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
			listAiUsage: {
				queryOptions: () => ({ queryKey: ['ai-usage'], queryFn: mocks.listUsage }),
			},
		},
	},
}));

describe('CreditsAiUsage', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('explains a non-admin contribution to the shared organization wallet', async () => {
		mocks.getSummary.mockResolvedValue({
			balanceMicroUsd: 0,
			lifetimeGrantedMicroUsd: 0,
			lifetimeSpentMicroUsd: 0,
			enabled: true,
		});
		mocks.listLedger.mockResolvedValue({ groups: [], nextCursor: null });
		mocks.listUsage.mockResolvedValue({ runs: [], nextCursor: null });

		renderCreditsAiUsage(false);

		expect(await screen.findByText(/You gave your \$5 welcome credit/)).toBeTruthy();
		expect(screen.queryByText('Available')).toBeNull();
		expect(screen.queryByText('nao credit usage')).toBeNull();
	});

	it('shows organization wallet totals to admins', async () => {
		mocks.getSummary.mockResolvedValue({
			balanceMicroUsd: 5_000_000,
			lifetimeGrantedMicroUsd: 5_000_000,
			lifetimeSpentMicroUsd: 0,
			enabled: true,
		});
		mocks.listLedger.mockResolvedValue({ groups: [], nextCursor: null });
		mocks.listUsage.mockResolvedValue({ runs: [], nextCursor: null });

		renderCreditsAiUsage(true);

		await screen.findByText('Available');
		expect(screen.queryByText(/You gave your \$5 welcome credit/)).toBeNull();
	});
});

function renderCreditsAiUsage(isAdmin: boolean) {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={queryClient}>
			<CreditsAiUsage isAdmin={isAdmin} />
		</QueryClientProvider>,
	);
}
