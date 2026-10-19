import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Fragment, useCallback } from 'react';

import { settingsNavGroups } from '@/components/sidebar-settings-nav';
import { Button } from '@/components/ui/button';
import { getLastAppHref } from '@/hooks/use-last-app-href';
import { cn } from '@/lib/utils';

interface SettingsCrumb {
	label: string;
	to?: string;
}

export function SettingsHeader() {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const crumbs = getSettingsCrumbs(pathname);
	const goBackToApp = useGoBackToApp();

	return (
		<header className='flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-3 md:px-4'>
			<Button
				variant='ghost'
				size='sm'
				onClick={goBackToApp}
				className='-ml-1 gap-1.5 text-muted-foreground hover:text-foreground'
			>
				<ArrowLeft />
				Back to app
			</Button>
			<div aria-hidden className='h-4 w-px shrink-0 bg-border' />
			<SettingsBreadcrumb crumbs={crumbs} />
		</header>
	);
}

function SettingsBreadcrumb({ crumbs }: { crumbs: SettingsCrumb[] }) {
	return (
		<nav aria-label='Settings breadcrumb' className='flex min-w-0 items-center gap-1 text-sm'>
			{crumbs.map((crumb, index) => {
				const isLast = index === crumbs.length - 1;
				const isGroup = !crumb.to && !isLast;
				return (
					<Fragment key={crumb.label}>
						{index > 0 && (
							<ChevronRight
								aria-hidden
								className={cn(
									'size-3.5 shrink-0 text-muted-foreground/50',
									isGroup && 'hidden md:block',
								)}
							/>
						)}
						<SettingsCrumbItem
							crumb={crumb}
							isLast={isLast}
							className={cn(isGroup && 'hidden md:inline')}
						/>
					</Fragment>
				);
			})}
		</nav>
	);
}

function SettingsCrumbItem({
	crumb,
	isLast,
	className,
}: {
	crumb: SettingsCrumb;
	isLast: boolean;
	className?: string;
}) {
	if (isLast) {
		return (
			<span aria-current='page' className={cn('truncate font-medium text-foreground', className)}>
				{crumb.label}
			</span>
		);
	}

	if (!crumb.to) {
		return <span className={cn('truncate text-muted-foreground', className)}>{crumb.label}</span>;
	}

	return (
		<Link
			to={crumb.to}
			className={cn('truncate text-muted-foreground transition-colors hover:text-foreground', className)}
		>
			{crumb.label}
		</Link>
	);
}

function useGoBackToApp() {
	const navigate = useNavigate();
	return useCallback(() => navigate({ href: getLastAppHref() }), [navigate]);
}

function getSettingsCrumbs(pathname: string): SettingsCrumb[] {
	const rootCrumb: SettingsCrumb = { label: 'Settings', to: '/settings' };
	const normalizedPathname = pathname.replace(/\/$/, '');
	const match = findClosestNavItem(normalizedPathname);
	if (!match) {
		return [rootCrumb];
	}

	const isOnItemPage = normalizedPathname === match.to;
	return [rootCrumb, { label: match.groupLabel }, { label: match.label, to: isOnItemPage ? undefined : match.to }];
}

function findClosestNavItem(pathname: string) {
	const candidates = settingsNavGroups.flatMap((group) =>
		group.items
			.filter((item) => item.to && !item.leavesSettings && isPathWithin(pathname, item.to))
			.map((item) => ({ groupLabel: group.label, label: item.label, to: item.to! })),
	);
	return candidates.reduce<(typeof candidates)[number] | undefined>(
		(closest, candidate) => (!closest || candidate.to.length > closest.to.length ? candidate : closest),
		undefined,
	);
}

function isPathWithin(pathname: string, basePath: string) {
	return pathname === basePath || pathname.startsWith(`${basePath}/`);
}
