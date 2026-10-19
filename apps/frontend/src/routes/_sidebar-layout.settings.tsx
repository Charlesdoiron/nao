import { createFileRoute, Outlet } from '@tanstack/react-router';
import { MobileHeader } from '@/components/mobile-header';
import { SettingsHeader } from '@/components/settings-header';

export const Route = createFileRoute('/_sidebar-layout/settings')({
	component: SettingsLayout,
});

function SettingsLayout() {
	return (
		<div className='flex flex-1 flex-col bg-panel min-w-0 overflow-hidden'>
			<MobileHeader />
			<SettingsHeader />
			<Outlet />
		</div>
	);
}
