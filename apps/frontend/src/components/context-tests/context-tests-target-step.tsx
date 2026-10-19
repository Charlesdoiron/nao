import { Link } from '@tanstack/react-router';
import { FileDiff, GitBranch, Globe, PencilLine, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ContextTest, TestTarget, TestTargetKind } from '@/components/context-tests/context-tests.mock';

import {
	PRODUCTION_DEPLOYMENT,
	contextBranches,
	contextReleaseTags,
	findBranch,
	findOwner,
	isTestLikelyAffected,
} from '@/components/context-tests/context-tests.mock';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const targetOptions: { kind: TestTargetKind; title: string; description: string; icon: LucideIcon }[] = [
	{
		kind: 'production',
		title: 'Production',
		description: 'The context your users chat with today.',
		icon: Globe,
	},
	{
		kind: 'branch',
		title: 'Working branch',
		description: 'Try context changes before they are merged.',
		icon: GitBranch,
	},
	{
		kind: 'tag',
		title: 'Release tag',
		description: 'Re-check a past version of the context.',
		icon: Tag,
	},
];

interface ContextTestsTargetStepProps {
	target: TestTarget;
	tests: ContextTest[];
	onTargetChange: (target: TestTarget) => void;
}

export function ContextTestsTargetStep({ target, tests, onTargetChange }: ContextTestsTargetStepProps) {
	const selectKind = (kind: TestTargetKind) => {
		if (kind === target.kind) {
			return;
		}
		onTargetChange({ kind, ref: defaultRefForKind(kind) });
	};

	return (
		<div className='flex flex-col gap-5'>
			<div role='radiogroup' aria-label='Context to test' className='grid grid-cols-1 gap-3 md:grid-cols-3'>
				{targetOptions.map((option) => (
					<TargetOptionCard
						key={option.kind}
						title={option.title}
						description={option.description}
						icon={option.icon}
						isSelected={target.kind === option.kind}
						onSelect={() => selectKind(option.kind)}
					/>
				))}
			</div>

			{target.kind === 'production' && <ProductionDetails />}
			{target.kind === 'branch' && (
				<BranchDetails
					branchName={target.ref}
					tests={tests}
					onBranchChange={(ref) => onTargetChange({ kind: 'branch', ref })}
				/>
			)}
			{target.kind === 'tag' && (
				<TagDetails tagName={target.ref} onTagChange={(ref) => onTargetChange({ kind: 'tag', ref })} />
			)}
		</div>
	);
}

function defaultRefForKind(kind: TestTargetKind): string {
	if (kind === 'branch') {
		return contextBranches[0].name;
	}
	if (kind === 'tag') {
		return contextReleaseTags[0].name;
	}
	return PRODUCTION_DEPLOYMENT.ref;
}

function TargetOptionCard({
	title,
	description,
	icon: Icon,
	isSelected,
	onSelect,
}: {
	title: string;
	description: string;
	icon: LucideIcon;
	isSelected: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type='button'
			role='radio'
			aria-checked={isSelected}
			onClick={onSelect}
			className={cn(
				'flex cursor-pointer flex-col gap-2 rounded-xl border p-4 text-left transition-colors',
				isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent/50',
			)}
		>
			<div className='flex items-center justify-between'>
				<Icon className={cn('size-4', isSelected ? 'text-primary' : 'text-muted-foreground')} />
				<span
					className={cn(
						'size-3.5 rounded-full border',
						isSelected ? 'border-4 border-primary' : 'border-muted-foreground/40',
					)}
				/>
			</div>
			<div>
				<div className='text-sm font-medium'>{title}</div>
				<div className='text-xs text-muted-foreground'>{description}</div>
			</div>
		</button>
	);
}

function ProductionDetails() {
	return (
		<DetailsPanel>
			<div className='flex items-center gap-2 text-sm'>
				<span className='size-2 rounded-full bg-green-500' />
				<span className='font-medium'>Live deployment</span>
				<span className='font-mono text-xs text-muted-foreground'>
					{PRODUCTION_DEPLOYMENT.ref} · {PRODUCTION_DEPLOYMENT.commit}
				</span>
				<span className='text-xs text-muted-foreground'>{PRODUCTION_DEPLOYMENT.deployedLabel}</span>
			</div>
			<p className='text-xs text-muted-foreground'>
				Test runs use the same context, models and warehouse connection as production chats. Nothing you do here
				changes what users see.
			</p>
		</DetailsPanel>
	);
}

function BranchDetails({
	branchName,
	tests,
	onBranchChange,
}: {
	branchName: string;
	tests: ContextTest[];
	onBranchChange: (branchName: string) => void;
}) {
	const branch = findBranch(branchName);
	const changedFiles = branch?.changedFiles ?? [];
	const affectedCount = tests.filter((test) => isTestLikelyAffected(test, changedFiles)).length;

	return (
		<DetailsPanel>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<div className='w-80'>
					<Select value={branchName} onValueChange={onBranchChange}>
						<SelectTrigger className='w-full'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{contextBranches.map((option) => (
								<SelectItem key={option.name} value={option.name}>
									<span className='font-mono text-xs'>{option.name}</span>
									<span className='text-xs text-muted-foreground'>
										{findOwner(option.authorId).name}
									</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<Button size='sm' variant='ghost' className='text-muted-foreground' asChild>
					<Link to='/settings/context-explorer'>
						<PencilLine />
						Edit context on this branch
					</Link>
				</Button>
			</div>
			{branch && (
				<div className='flex flex-col gap-2'>
					<div className='text-xs text-muted-foreground'>
						{findOwner(branch.authorId).name} · {branch.updatedLabel} · {changedFiles.length} context{' '}
						{changedFiles.length === 1 ? 'file' : 'files'} changed vs production
					</div>
					<ul className='flex flex-col gap-1 rounded-lg bg-muted/50 p-2'>
						{changedFiles.map((file) => (
							<li key={file} className='flex items-center gap-2 font-mono text-xs'>
								<FileDiff className='size-3.5 text-amber-500' />
								{file}
							</li>
						))}
					</ul>
				</div>
			)}
			<Callout>
				<span className='font-medium text-foreground'>
					{affectedCount} of {tests.length} questions are likely affected
				</span>{' '}
				by these files, based on which context the agent read when answering them before. They will be
				pre-selected in the next step, so you only pay for the runs that matter.
			</Callout>
		</DetailsPanel>
	);
}

function TagDetails({ tagName, onTagChange }: { tagName: string; onTagChange: (tagName: string) => void }) {
	return (
		<DetailsPanel>
			<div className='w-80'>
				<Select value={tagName} onValueChange={onTagChange}>
					<SelectTrigger className='w-full'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{contextReleaseTags.map((option) => (
							<SelectItem key={option.name} value={option.name}>
								<span className='font-mono text-xs'>{option.name}</span>
								<span className='text-xs text-muted-foreground'>{option.dateLabel}</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<p className='text-xs text-muted-foreground'>
				Useful to compare against a known-good release, or to check whether a regression was already there
				before the last deploy.
			</p>
		</DetailsPanel>
	);
}

function DetailsPanel({ children }: { children: React.ReactNode }) {
	return <div className='flex flex-col gap-3 rounded-xl border p-4'>{children}</div>;
}
