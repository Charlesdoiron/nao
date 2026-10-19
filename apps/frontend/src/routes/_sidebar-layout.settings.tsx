import { createFileRoute, Outlet } from '@tanstack/react-router';
import { MobileHeader } from '@/components/mobile-header';
import { SettingsNavPanel } from '@/components/settings-nav-panel';
import { useSidebar } from '@/contexts/sidebar';
import { usePermissions } from '@/hooks/use-permissions';

export const Route = createFileRoute('/_sidebar-layout/settings')({
	component: SettingsLayout,
});

function SettingsLayout() {
	const { isMobile } = useSidebar();
	const { isViewer } = usePermissions();
	const showNavPanel = !isMobile && !isViewer;

	return (
		<div className='flex flex-1 bg-panel min-w-0 overflow-hidden'>
			{showNavPanel && (
				<SettingsNavPanel className='w-60 shrink-0 border-r border-sidebar-border bg-background' />
			)}
			<div className='flex flex-1 flex-col min-w-0 overflow-hidden'>
				<MobileHeader />
				<Outlet />
			</div>
		</div>
	);
}
