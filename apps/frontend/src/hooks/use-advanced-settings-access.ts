import { useEffectiveUserGroupFeatures } from '@/hooks/use-effective-user-group-features';
import { usePermissions } from '@/hooks/use-permissions';
import { hasAdvancedSettingsAccess } from '@/lib/advanced-settings-access';

export function useAdvancedSettingsAccess(): boolean {
	const { role } = usePermissions();
	const { features } = useEffectiveUserGroupFeatures();
	return hasAdvancedSettingsAccess(role, features);
}
