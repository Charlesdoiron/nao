// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { ChatPrompt } from './chat-input-prompt';

const mocks = vi.hoisted(() => ({
	activeProjectId: null as string | null,
	project: null as { id: string } | null,
}));

vi.mock('@tanstack/react-query', () => ({
	useQuery: (options: { queryKey: string[] }) => {
		switch (options.queryKey[0]) {
			case 'project':
				return { data: mocks.project };
			case 'skills':
				return { data: [{ name: 'Old skill', description: null }], isFetching: false };
			case 'database-objects':
				return {
					data: [
						{
							type: 'table',
							database: 'old',
							schema: 'public',
							table: 'orders',
							fqdn: 'old.public.orders',
						},
					],
					isFetching: false,
				};
			default:
				return { data: undefined, isFetching: false };
		}
	},
}));

vi.mock('prompt-mentions', () => ({
	Prompt: ({ mentionConfigs }: { mentionConfigs: { options: { id: string; label: string }[] }[] }) => (
		<div>{mentionConfigs.flatMap((config) => config.options).map((option) => option.label)}</div>
	),
}));

vi.mock('@/hooks/use-custom-stories-enabled', () => ({
	useCustomStoriesEnabled: () => false,
}));

vi.mock('@/hooks/use-effective-user-group-features', () => ({
	useEffectiveUserGroupFeatures: () => ({ customStoryCreationEnabled: false }),
}));

vi.mock('@/lib/active-project', () => ({
	getActiveProjectId: () => mocks.activeProjectId,
}));

vi.mock('@/main', () => ({
	trpc: {
		project: {
			getCurrent: { queryOptions: () => ({ queryKey: ['project'] }) },
			getDatabaseObjects: { queryOptions: () => ({ queryKey: ['database-objects'] }) },
		},
		skill: {
			list: { queryOptions: () => ({ queryKey: ['skills'] }) },
		},
	},
}));

beforeEach(() => {
	mocks.activeProjectId = null;
	mocks.project = null;
});

it('hides cached project mentions when no project is active', () => {
	render(<ChatPrompt promptRef={{ current: null }} placeholder='' storyCreationEnabled={false} onChange={vi.fn()} />);

	expect(screen.queryByText('Old skill')).toBeNull();
	expect(screen.queryByText('orders')).toBeNull();
});
