import { useQuery } from '@tanstack/react-query';

import { ProjectSwitcher } from './project-selector';
import { SidebarCommunity } from './sidebar-community';
import { SidebarSettingsNav } from './sidebar-settings-nav';
import { useIsCloud } from '@/hooks/use-nao-mode';
import { usePermissions } from '@/hooks/use-permissions';
import { useProjectSwitch } from '@/hooks/use-project-switch';
import { cn } from '@/lib/utils';
import { trpc } from '@/main';

export function SettingsNavPanel({
	className,
	onProjectSwitched,
}: {
	className?: string;
	onProjectSwitched?: () => void;
}) {
	const project = useQuery(trpc.project.getCurrent.queryOptions());
	const projects = useQuery(trpc.project.listForCurrentUser.queryOptions());
	const config = useQuery(trpc.system.getPublicConfig.queryOptions());
	const switchProject = useProjectSwitch(project.data?.id);
	const { isAdmin, isContextAdmin, isOrgAdmin, isViewer } = usePermissions();
	const isCloud = useIsCloud();

	const handleProjectChange = async (projectId: string) => {
		const didSwitch = await switchProject(projectId);
		if (didSwitch) {
			onProjectSwitched?.();
		}
	};

	return (
		<aside className={cn('flex flex-col min-h-0 overflow-hidden', className)}>
			<div className='flex flex-col gap-2 px-2 pt-3'>
				<h2 className='px-2 text-sm font-semibold text-foreground'>Settings</h2>
				<ProjectSwitcher
					projects={projects.data ?? []}
					currentProjectId={project.data?.id}
					onChange={handleProjectChange}
					variant='sidebar'
				/>
			</div>
			<SidebarSettingsNav
				isCollapsed={false}
				isAdmin={isAdmin}
				isContextAdmin={isContextAdmin}
				isViewer={isViewer}
				isCloud={isCloud}
				isCloudBillingEnabled={config.data?.cloudBillingEnabled === true}
				isOrgAdmin={isOrgAdmin}
			/>
			<div className='pt-2'>
				<SidebarCommunity isCollapsed={false} />
			</div>
		</aside>
	);
}
