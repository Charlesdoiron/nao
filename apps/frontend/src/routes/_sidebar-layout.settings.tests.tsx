import { createFileRoute } from '@tanstack/react-router';

import { ContextTestsSuite } from '@/components/settings/context-tests-suite';
import { SettingsPageWrapper } from '@/components/ui/settings-card';
import { requireContextAdminOrAdmin } from '@/lib/route-guards';

export const Route = createFileRoute('/_sidebar-layout/settings/tests')({
	beforeLoad: requireContextAdminOrAdmin,
	component: TestsPage,
});

function TestsPage() {
	return (
		<SettingsPageWrapper wide>
			<ContextTestsSuite />
		</SettingsPageWrapper>
	);
}
