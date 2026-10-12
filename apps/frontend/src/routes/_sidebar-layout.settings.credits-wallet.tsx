import { createFileRoute } from '@tanstack/react-router';

import { CreditsWalletContent } from '@/components/settings/credits-wallet-content';
import { SettingsPageWrapper } from '@/components/ui/settings-card';
import { usePermissions } from '@/hooks/use-permissions';
import { requireCloud } from '@/lib/require-admin';

export const Route = createFileRoute('/_sidebar-layout/settings/credits-wallet')({
	beforeLoad: requireCloud,
	component: CreditsWalletPage,
});

function CreditsWalletPage() {
	const { isOrgAdmin, role } = usePermissions();
	const adminStatus = role ? isOrgAdmin : undefined;

	return (
		<SettingsPageWrapper>
			<div className='flex flex-col gap-5'>
				<div>
					<h1 className='text-lg font-semibold text-foreground'>Credits & wallet</h1>
					<p className='text-sm text-muted-foreground'>
						{adminStatus === false
							? 'See how your welcome credit is shared with your organization.'
							: "View your organization's credit balance, wallet history, and chat usage."}
					</p>
				</div>
				<CreditsWalletContent isAdmin={adminStatus} />
			</div>
		</SettingsPageWrapper>
	);
}
