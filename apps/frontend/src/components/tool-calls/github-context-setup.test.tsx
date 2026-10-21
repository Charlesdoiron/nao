// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GithubContextSetup } from './github-context-setup';
import type { GithubContextValues } from './github-context-setup';

vi.mock('@/main', () => ({
	trpc: {
		github: {
			isAvailable: {
				queryOptions: () => ({
					queryKey: ['github-available'],
					queryFn: async () => true,
				}),
			},
			getStatus: {
				queryOptions: () => ({
					queryKey: ['github-status'],
					queryFn: async () => ({ connected: true, user: { login: 'octocat', avatarUrl: '' } }),
				}),
			},
		},
	},
}));

vi.mock('@/components/settings/github-repo-list', () => ({
	GithubRepoList: ({
		onSelect,
	}: {
		onSelect: (value: string, repo: { full_name: string; default_branch: string }) => void;
	}) => (
		<button
			type='button'
			onClick={() => onSelect('acme/analytics', { full_name: 'acme/analytics', default_branch: 'main' })}
		>
			acme/analytics
		</button>
	),
}));

afterEach(cleanup);

describe('GithubContextSetup', () => {
	it('selects a repository from the connected GitHub account', async () => {
		render(
			<QueryClientProvider client={new QueryClient()}>
				<GithubHarness />
			</QueryClientProvider>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
		await waitFor(() => expect(screen.getByText('Connected as octocat')).toBeTruthy());
		fireEvent.click(screen.getByRole('button', { name: 'acme/analytics' }));

		expect(screen.getByText('Connected')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Hide' })).toBeTruthy();
	});
});

function GithubHarness() {
	const [values, setValues] = useState<GithubContextValues>({ repoFullName: '', branch: '' });
	return <GithubContextSetup values={values} isStarting={false} onValuesChange={setValues} />;
}
