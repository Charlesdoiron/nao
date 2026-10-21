// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { useMemberPicker, useShareAudience } from './use-share-dialog';

const mocks = vi.hoisted(() => ({
	activeProjectId: null as string | null,
	isFetching: false,
	project: null as { id: string } | null,
}));

vi.mock('@tanstack/react-query', () => ({
	useQuery: (options: { queryKey: string[] }) => {
		switch (options.queryKey[0]) {
			case 'project':
				return { data: mocks.project };
			case 'sharing-access':
				return { data: { canShareToProject: true }, isFetching: mocks.isFetching };
			case 'members':
				return {
					data: [{ id: 'old-member', name: 'Old member', email: 'old@example.com' }],
					isFetching: mocks.isFetching,
				};
			default:
				return { data: undefined, isFetching: false };
		}
	},
}));

vi.mock('@/lib/active-project', () => ({
	getActiveProjectId: () => mocks.activeProjectId,
}));

vi.mock('@/main', () => ({
	trpc: {
		project: {
			getCurrent: { queryOptions: () => ({ queryKey: ['project'] }) },
			getProjectMembersByChatId: { queryOptions: () => ({ queryKey: ['members'] }) },
		},
		userGroup: {
			projectSharingAccess: { queryOptions: () => ({ queryKey: ['sharing-access'] }) },
		},
	},
}));

beforeEach(() => {
	mocks.activeProjectId = null;
	mocks.isFetching = false;
	mocks.project = null;
});

it('hides cached sharing access and members when no project is active', () => {
	const { result } = renderHook(() => ({
		audience: useShareAudience(),
		memberPicker: useMemberPicker('current-user', undefined, 'chat-id'),
	}));

	expect(result.current.audience.canShareToProject).toBe(false);
	expect(result.current.memberPicker.otherMembers).toEqual([]);
	expect(result.current.memberPicker.filteredMembers).toEqual([]);
});

it('hides previous project sharing data while the selected project refetches', () => {
	mocks.activeProjectId = 'new-project';
	mocks.isFetching = true;
	mocks.project = { id: 'new-project' };

	const { result } = renderHook(() => ({
		audience: useShareAudience(),
		memberPicker: useMemberPicker('current-user', undefined, 'chat-id'),
	}));

	expect(result.current.audience.canShareToProject).toBe(false);
	expect(result.current.memberPicker.otherMembers).toEqual([]);
});
