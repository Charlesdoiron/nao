// @vitest-environment jsdom

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { useModelSelection } from './use-model-selection';

const mocks = vi.hoisted(() => ({
	queries: [] as Array<{ queryKey: string[]; enabled?: boolean }>,
}));

vi.mock('@tanstack/react-query', () => ({
	useQuery: (options: { queryKey: string[]; enabled?: boolean }) => {
		mocks.queries.push(options);
		return { data: options.queryKey[0] === 'current-project' ? null : [{ provider: 'nao' }], isPending: false };
	},
}));

vi.mock('@/contexts/agent.provider', () => ({
	useAgentContext: () => ({
		selectedModel: null,
		usesDefaultModel: true,
		setSelectedModel: vi.fn(),
	}),
}));

vi.mock('@/main', () => ({
	trpc: {
		project: {
			getCurrent: { queryOptions: () => ({ queryKey: ['current-project'] }) },
			getDefaultChatModel: { queryOptions: () => ({ queryKey: ['default-model'] }) },
			listAvailableTranscribeModels: { queryOptions: () => ({ queryKey: ['available-models'] }) },
		},
	},
}));

afterEach(() => {
	cleanup();
	mocks.queries = [];
});

it('does not request project models when the user has no project', () => {
	const { result } = renderHook(() => useModelSelection());

	expect(mocks.queries.find((query) => query.queryKey[0] === 'available-models')?.enabled).toBe(false);
	expect(mocks.queries.find((query) => query.queryKey[0] === 'default-model')?.enabled).toBe(false);
	expect(result.current.availableModels).toBeUndefined();
	expect(result.current.hasProject).toBe(false);
});
