import { ChevronDown, GitBranch, Search, Sparkles, X } from 'lucide-react';
import { EMPTY_FILTERS, hasActiveFilters, STATUS_LABELS } from './test-suite-utils';
import type { ReactNode } from 'react';

import type { GitRef, TestFilters, TestStatus } from './test-suite-types';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const STATUS_ORDER: TestStatus[] = ['regressed', 'improved', 'flaky', 'failing', 'passing', 'not-run'];

export function TestFilterBar({
	filters,
	onChange,
	tagCounts,
	owners,
	candidateRef,
	isComparing,
	likelyAffectedCount,
}: {
	filters: TestFilters;
	onChange: (filters: TestFilters) => void;
	tagCounts: Map<string, number>;
	owners: string[];
	candidateRef: GitRef;
	isComparing: boolean;
	likelyAffectedCount: number;
}) {
	const statuses = isComparing ? STATUS_ORDER : STATUS_ORDER.filter((s) => s !== 'regressed' && s !== 'improved');

	function toggleValue(key: 'tags' | 'owners', value: string) {
		const current = filters[key];
		onChange({
			...filters,
			[key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
		});
	}

	return (
		<div className='flex flex-wrap items-center gap-2'>
			<div className='relative w-full sm:w-72'>
				<Search className='pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground' />
				<Input
					value={filters.search}
					onChange={(event) => onChange({ ...filters, search: event.target.value })}
					placeholder='Filter by name or prefix, e.g. revenue/'
					className='h-8 pl-8 text-sm'
				/>
			</div>

			<FilterDropdown label='Tags' count={filters.tags.length}>
				<DropdownMenuLabel>Filter by tag</DropdownMenuLabel>
				{[...tagCounts.entries()].map(([tag, count]) => (
					<DropdownMenuCheckboxItem
						key={tag}
						checked={filters.tags.includes(tag)}
						onCheckedChange={() => toggleValue('tags', tag)}
						onSelect={(event) => event.preventDefault()}
					>
						<span className='mr-auto'>{tag}</span>
						<span className='text-xs text-muted-foreground'>{count}</span>
					</DropdownMenuCheckboxItem>
				))}
			</FilterDropdown>

			<FilterDropdown label='Owner' count={filters.owners.length}>
				{candidateRef.pushedBy.length > 0 && (
					<>
						<DropdownMenuItem onSelect={() => onChange({ ...filters, owners: candidateRef.pushedBy })}>
							<GitBranch className='size-3.5' />
							Pushed to <span className='font-mono text-xs'>{candidateRef.name}</span>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
					</>
				)}
				<DropdownMenuLabel>Filter by owner</DropdownMenuLabel>
				{owners.map((owner) => (
					<DropdownMenuCheckboxItem
						key={owner}
						checked={filters.owners.includes(owner)}
						onCheckedChange={() => toggleValue('owners', owner)}
						onSelect={(event) => event.preventDefault()}
					>
						<Avatar username={owner} className='size-4 text-[8px]' />
						<span className='mr-auto'>{owner}</span>
						{candidateRef.pushedBy.includes(owner) && (
							<GitBranch className='size-3 text-muted-foreground' aria-label='Pushed to this branch' />
						)}
					</DropdownMenuCheckboxItem>
				))}
			</FilterDropdown>

			<FilterDropdown
				label={filters.status === 'all' ? 'Status' : STATUS_LABELS[filters.status]}
				count={filters.status === 'all' ? 0 : 1}
				hideCount
			>
				<DropdownMenuRadioGroup
					value={filters.status}
					onValueChange={(value) => onChange({ ...filters, status: value as TestFilters['status'] })}
				>
					<DropdownMenuRadioItem value='all'>All statuses</DropdownMenuRadioItem>
					<DropdownMenuSeparator />
					{statuses.map((status) => (
						<DropdownMenuRadioItem key={status} value={status}>
							{STATUS_LABELS[status]}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</FilterDropdown>

			{isComparing && candidateRef.changedContextFiles.length > 0 && (
				<SimpleTooltip content='Estimated from the context files changed on this branch. Prose edits can affect any test, so treat this as a starting point, not a guarantee.'>
					<Button
						variant='outline'
						size='sm'
						className={cn(
							'h-8 rounded-lg',
							filters.onlyLikelyAffected && 'border-primary/40 bg-primary/5 text-foreground',
						)}
						onClick={() => onChange({ ...filters, onlyLikelyAffected: !filters.onlyLikelyAffected })}
					>
						<Sparkles className='size-3.5' />
						Likely affected
						<span className='text-xs text-muted-foreground'>{likelyAffectedCount}</span>
					</Button>
				</SimpleTooltip>
			)}

			{hasActiveFilters(filters) && (
				<Button variant='ghost-muted' size='sm' className='h-8' onClick={() => onChange(EMPTY_FILTERS)}>
					<X className='size-3.5' />
					Clear
				</Button>
			)}
		</div>
	);
}

function FilterDropdown({
	label,
	count,
	hideCount = false,
	children,
}: {
	label: string;
	count: number;
	hideCount?: boolean;
	children: ReactNode;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant='outline'
					size='sm'
					className={cn('h-8 rounded-lg', count > 0 && 'border-primary/40 bg-primary/5 text-foreground')}
				>
					{label}
					{count > 0 && !hideCount && (
						<span className='rounded-full bg-primary/15 px-1.5 text-[11px] tabular-nums'>{count}</span>
					)}
					<ChevronDown className='size-3.5 opacity-60' />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='start' className='min-w-56'>
				{children}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
