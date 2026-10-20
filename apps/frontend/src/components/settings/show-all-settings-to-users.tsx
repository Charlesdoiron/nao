import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { UserGroupCheckboxRow } from '@/components/settings/user-group-checkbox-row';
import { invalidateUserGroupQueries } from '@/components/settings/user-group-editor';
import { trpc } from '@/main';

/** Stored as the All Users group grant: every project member belongs to it, so it applies project-wide. */
export function ShowAllSettingsToUsers() {
	const queryClient = useQueryClient();
	const overview = useQuery(trpc.userGroup.overview.queryOptions());
	const updateGroup = useMutation(trpc.userGroup.update.mutationOptions());
	const allUsersGroup = overview.data?.groups.find((group) => group.isDefault);

	if (!allUsersGroup || allUsersGroup.isLocked) {
		return null;
	}

	const handleCheckedChange = async (checked: boolean) => {
		const otherGrants = allUsersGroup.featureGrants.filter((feature) => feature !== 'advancedSettings');
		await updateGroup.mutateAsync({
			groupId: allUsersGroup.id,
			featureGrants: checked ? [...otherGrants, 'advancedSettings'] : otherGrants,
			toolCallDensityPolicy: allUsersGroup.toolCallDensityPolicy,
		});
		await invalidateUserGroupQueries(queryClient);
	};

	return (
		<UserGroupCheckboxRow
			id='show-all-settings-to-users'
			label='Show all settings to users'
			description='Users can see project and organization settings. When off, they only see their own account settings. Admins always see everything.'
			checked={allUsersGroup.featureGrants.includes('advancedSettings')}
			disabled={updateGroup.isPending}
			onCheckedChange={(checked) => void handleCheckedChange(checked)}
		/>
	);
}
