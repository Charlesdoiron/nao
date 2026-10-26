import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	addOrgMemberIfMissing: vi.fn(),
	addProjectMember: vi.fn(),
	addProjectMemberWithUserGroups: vi.fn(),
	getOrganizationById: vi.fn(),
	getProjectById: vi.fn(),
	getUser: vi.fn(),
	recordOrganizationJoinCandidate: vi.fn(),
	recordProjectJoinCandidate: vi.fn(),
}));

vi.mock('../src/queries/organization.queries', () => ({
	addOrgMemberIfMissing: mocks.addOrgMemberIfMissing,
	getOrganizationById: mocks.getOrganizationById,
}));
vi.mock('../src/queries/project.queries', () => ({
	addProjectMember: mocks.addProjectMember,
	getProjectById: mocks.getProjectById,
}));
vi.mock('../src/queries/user.queries', () => ({
	getUser: mocks.getUser,
}));
vi.mock('../src/services/context-explorer-git.service', () => ({
	cleanupContextWorktree: vi.fn(),
}));
vi.mock('../src/services/credit-grant.service', () => ({
	recordOrganizationJoinCandidate: mocks.recordOrganizationJoinCandidate,
	recordProjectJoinCandidate: mocks.recordProjectJoinCandidate,
}));
vi.mock('../src/services/project-user-group-membership.service', () => ({
	addProjectMemberWithUserGroups: mocks.addProjectMemberWithUserGroups,
}));

import { addOrganizationMemberIfMissing, addProjectMember } from '../src/services/membership.service';

describe('membership service', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getOrganizationById.mockResolvedValue({ id: 'org-1' });
		mocks.getProjectById.mockResolvedValue({ id: 'project-1' });
		mocks.getUser.mockResolvedValue({ id: 'user-1' });
	});

	it('records a join candidate after adding a missing organization member', async () => {
		const member = { orgId: 'org-1', userId: 'user-1', role: 'user' as const };

		await addOrganizationMemberIfMissing(member);

		expect(mocks.addOrgMemberIfMissing).toHaveBeenCalledWith(member);
		expect(mocks.recordOrganizationJoinCandidate).toHaveBeenCalledWith('org-1', 'user-1');
	});

	it.each([
		{ description: 'without groups', groupIds: [] },
		{ description: 'with groups', groupIds: ['analysts'] },
	])('records a join candidate after adding a project member $description', async ({ groupIds }) => {
		const member = { projectId: 'project-1', userId: 'user-1', role: 'user' as const };

		await addProjectMember(member, groupIds);

		if (groupIds.length) {
			expect(mocks.addProjectMemberWithUserGroups).toHaveBeenCalledWith(member, groupIds);
			expect(mocks.addProjectMember).not.toHaveBeenCalled();
		} else {
			expect(mocks.addProjectMember).toHaveBeenCalledWith(member);
			expect(mocks.addProjectMemberWithUserGroups).not.toHaveBeenCalled();
		}
		expect(mocks.recordProjectJoinCandidate).toHaveBeenCalledWith('project-1', 'user-1');
	});
});
