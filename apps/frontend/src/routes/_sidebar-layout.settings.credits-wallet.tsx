import { createFileRoute, redirect } from '@tanstack/react-router';

import type { OrganizationCreditsTab } from '@/components/settings/credits-wallet-content';
import { OrganizationCreditsContent } from '@/components/settings/credits-wallet-content';
import { SettingsPageWrapper } from '@/components/ui/settings-card';
import { usePermissions } from '@/hooks/use-permissions';
import { requireOrganizationAdminCloud } from '@/lib/route-guards';

export const Route = createFileRoute('/_sidebar-layout/settings/credits-wallet')({
	beforeLoad: async () => {
		const config = await requireOrganizationAdminCloud();
		if (config.cloudBillingEnabled) {
			throw redirect({
				to: '/settings/organization/billing',
				search: { checkout: undefined, portal: undefined, creditCheckout: undefined },
			});
		}
	},
	validateSearch: (search: Record<string, unknown>): { creditsTab?: OrganizationCreditsTab } => ({
		creditsTab: search.creditsTab === 'history' || search.creditsTab === 'usage' ? search.creditsTab : undefined,
	}),
	component: CreditsWalletPage,
});

function CreditsWalletPage() {
	const { canViewChatReplay } = usePermissions();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<SettingsPageWrapper wide>
			<div className='flex flex-col gap-5'>
				<div>
					<h1 className='text-lg font-semibold text-foreground'>Organization credits</h1>
					<p className='text-sm text-muted-foreground'>
						View your organization&apos;s nao credit balance, credit history, and nao AI usage.
					</p>
				</div>
				<OrganizationCreditsContent
					canTopUp={false}
					canViewReplay={canViewChatReplay}
					activeTab={search.creditsTab ?? 'history'}
					onTabChange={(creditsTab) => {
						navigate({ search: { creditsTab }, replace: true, resetScroll: false });
					}}
				/>
			</div>
		</SettingsPageWrapper>
	);
}
