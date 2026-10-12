// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CreditsWalletContent } from './credits-wallet-content';
import type { AnchorHTMLAttributes } from 'react';

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

vi.mock('@tanstack/react-router', () => ({
	Link: ({ children, 'aria-label': ariaLabel }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
		<a href='#replay' aria-label={ariaLabel}>
			{children}
		</a>
	),
}));

describe('CreditsWalletContent', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('shows organization wallet totals to admins', async () => {
		mocks.getSummary.mockResolvedValue({
			balanceMicroUsd: 5_000_000,
			lifetimeCreditedMicroUsd: 5_000_000,
			lifetimeDebitedMicroUsd: 0,
			enabled: true,
		});
		mocks.listLedger.mockResolvedValue({
			groups: [
				{
					id: 'gift',
					createdAt: new Date(),
					grantedForUserName: 'Managed User',
					usageUserName: null,
					entries: [
						{
							entryType: 'gift',
							deltaMicroUsd: 5_000_000,
							balanceAfterMicroUsd: 5_000_000,
						},
					],
				},
				{
					id: 'run',
					createdAt: new Date(),
					grantedForUserName: null,
					usageUserName: 'Managed User',
					entries: [
						{
							entryType: 'usage',
							deltaMicroUsd: -1_000,
							balanceAfterMicroUsd: 4_999_000,
						},
						{
							entryType: 'usage',
							deltaMicroUsd: -1_000,
							balanceAfterMicroUsd: 4_998_000,
						},
					],
				},
			],
			nextCursor: null,
		});
		mocks.listUsage.mockResolvedValue({
			runs: [
				{
					id: 'run',
					startedAt: new Date(),
					chatTitle: 'Sales analysis',
					userName: 'Managed User',
					events: [
						{
							id: 'usage',
							chatId: 'chat-1',
							category: 'chat',
							llmModelId: 'gpt-5.6',
							llmProvider: 'nao',
							status: 'completed',
							costSource: 'price_book',
							totalTokens: 100,
							upstreamCostMicroUsd: 1_000,
							customerChargeMicroUsd: 2_000,
						},
					],
				},
			],
			nextCursor: null,
		});

		renderCreditsWalletContent(true);

		await screen.findByText('Available');
		expect(screen.getByRole('link', { name: 'Open chat replay' })).toBeTruthy();
		expect(
			await screen.findByText(
				(_, element) => element?.tagName === 'TD' && element.textContent?.trim() === '$5 nao gift Managed User',
			),
		).toBeTruthy();
		expect(
			await screen.findByText(
				(_, element) =>
					element?.tagName === 'TD' && element.textContent?.trim() === 'nao AI - Managed User 2 calls',
			),
		).toBeTruthy();
		expect(await screen.findByText(/Managed User · .* · gpt-5\.6/)).toBeTruthy();
		expect(screen.queryByText(/You gave your \$5 welcome credit/)).toBeNull();
	});
});

function renderCreditsWalletContent(canViewReplay: boolean) {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={queryClient}>
			<CreditsWalletContent canViewReplay={canViewReplay} />
		</QueryClientProvider>,
	);
}
