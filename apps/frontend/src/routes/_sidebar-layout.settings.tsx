import { createFileRoute, Outlet } from '@tanstack/react-router';
import { MobileHeader } from '@/components/mobile-header';
import { requireAdvancedSettingsForPage } from '@/lib/route-guards';

export const Route = createFileRoute('/_sidebar-layout/settings')({
	beforeLoad: requireAdvancedSettingsForPage,
	component: SettingsLayout,
});

function SettingsLayout() {
	return (
		<div className='flex flex-1 flex-col bg-panel min-w-0 overflow-hidden'>
			<MobileHeader />
			<Outlet />
		</div>
	);
}
