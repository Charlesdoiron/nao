import { FileText, GitBranch, Play, Tag as TagIcon } from 'lucide-react';

import { COST_PER_RUN_USD } from './test-suite-mock-data';
import type { GitRef } from './test-suite-types';

import { Button } from '@/components/ui/button';
import { IconSegmentedToggle } from '@/components/ui/icon-segmented-toggle';
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { useTimeAgo } from '@/hooks/use-time-ago';

const RUNS_PER_TEST_OPTIONS = [
	{ value: '1', label: '1×' },
	{ value: '3', label: '3×' },
	{ value: '5', label: '5×' },
] as const;

export type RunsPerTest = (typeof RUNS_PER_TEST_OPTIONS)[number]['value'];

export function TestRunTargetBar({
	refs,
	baselineRef,
	candidateRef,
	onCandidateChange,
	runsPerTest,
	onRunsPerTestChange,
	includeBaseline,
	onIncludeBaselineChange,
	runScopeCount,
	runScopeLabel,
	isRunning,
	onRun,
}: {
	refs: GitRef[];
	baselineRef: GitRef;
	candidateRef: GitRef;
	onCandidateChange: (refId: string) => void;
	runsPerTest: RunsPerTest;
	onRunsPerTestChange: (value: RunsPerTest) => void;
	includeBaseline: boolean;
	onIncludeBaselineChange: (value: boolean) => void;
	runScopeCount: number;
	runScopeLabel: string;
	isRunning: boolean;
	onRun: () => void;
}) {
	const isComparing = candidateRef.id !== baselineRef.id;
	const targetCount = isComparing && includeBaseline ? 2 : 1;
	const totalRuns = runScopeCount * Number(runsPerTest) * targetCount;
	const estimatedCost = totalRuns * COST_PER_RUN_USD;

	return (
		<section className='rounded-xl border bg-background/60 shadow-xs'>
			<div className='flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3'>
				<RefPill ref_={baselineRef} label='Production' />
				<span className='text-xs text-muted-foreground'>vs</span>
				<CandidateRefSelect refs={refs} value={candidateRef.id} onChange={onCandidateChange} />
				<div className='ml-auto flex flex-wrap items-center gap-4'>
					<div className='flex items-center gap-2'>
						<span className='text-xs text-muted-foreground'>Runs per test</span>
						<IconSegmentedToggle
							options={RUNS_PER_TEST_OPTIONS}
							value={runsPerTest}
							onValueChange={onRunsPerTestChange}
							showLabels
							showIcons={false}
						/>
					</div>
					{isComparing && (
						<label className='flex items-center gap-2 text-xs text-muted-foreground cursor-pointer'>
							<Switch checked={includeBaseline} onCheckedChange={onIncludeBaselineChange} />
							Re-run production
						</label>
					)}
				</div>
			</div>
			<div className='flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-2.5'>
				<CandidateRefSummary candidateRef={candidateRef} isComparing={isComparing} />
				<div className='ml-auto flex items-center gap-3'>
					<SimpleTooltip
						content={`${runScopeCount} tests × ${runsPerTest} runs × ${targetCount} target${targetCount > 1 ? 's' : ''}`}
					>
						<span className='text-xs text-muted-foreground tabular-nums'>
							{totalRuns} runs · ≈ ${estimatedCost.toFixed(2)}
						</span>
					</SimpleTooltip>
					<Button
						variant='primary-gradient'
						size='sm'
						onClick={onRun}
						disabled={runScopeCount === 0}
						isLoading={isRunning}
					>
						{!isRunning && <Play className='size-3.5' />}
						{runScopeLabel}
					</Button>
				</div>
			</div>
		</section>
	);
}

function RefPill({ ref_, label }: { ref_: GitRef; label: string }) {
	return (
		<div className='flex h-8 items-center gap-2 rounded-lg border border-input bg-muted/40 px-2.5 text-sm'>
			<span className='size-1.5 rounded-full bg-green-500' />
			<span className='font-medium'>{label}</span>
			<span className='font-mono text-xs text-muted-foreground'>
				{ref_.name} @ {ref_.commit}
			</span>
		</div>
	);
}

function CandidateRefSelect({
	refs,
	value,
	onChange,
}: {
	refs: GitRef[];
	value: string;
	onChange: (refId: string) => void;
}) {
	const branches = refs.filter((ref) => ref.kind === 'branch');
	const tags = refs.filter((ref) => ref.kind === 'tag');

	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger className='min-w-64 font-mono text-[13px]'>
				<SelectValue />
			</SelectTrigger>
			<SelectContent position='popper' align='start'>
				<SelectGroup>
					<SelectLabel>Branches</SelectLabel>
					{branches.map((ref) => (
						<SelectItem key={ref.id} value={ref.id}>
							<GitBranch className='size-3.5' />
							<span className='font-mono text-[13px]'>{ref.name}</span>
							{ref.isProduction && <span className='text-xs text-muted-foreground'>production</span>}
						</SelectItem>
					))}
				</SelectGroup>
				<SelectSeparator />
				<SelectGroup>
					<SelectLabel>Versions</SelectLabel>
					{tags.map((ref) => (
						<SelectItem key={ref.id} value={ref.id}>
							<TagIcon className='size-3.5' />
							<span className='font-mono text-[13px]'>{ref.name}</span>
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}

function CandidateRefSummary({ candidateRef, isComparing }: { candidateRef: GitRef; isComparing: boolean }) {
	const updated = useTimeAgo(candidateRef.updatedAt);

	if (!isComparing) {
		return (
			<p className='text-xs text-muted-foreground'>
				Running against production only. Pick a branch or version to compare reliability.
			</p>
		);
	}

	const changedFiles = candidateRef.changedContextFiles;
	return (
		<div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
			{candidateRef.kind === 'branch' ? (
				<span>
					{candidateRef.commitsAhead} commits ahead of main · pushed by{' '}
					<span className='text-foreground'>{candidateRef.pushedBy.join(', ')}</span> ·{' '}
					{updated.humanReadable}
				</span>
			) : (
				<span>
					Tagged by <span className='text-foreground'>{candidateRef.pushedBy.join(', ')}</span> ·{' '}
					{updated.humanReadable}
				</span>
			)}
			{changedFiles.length > 0 && (
				<SimpleTooltip
					content={
						<div className='flex flex-col gap-0.5 font-mono'>
							{changedFiles.map((file) => (
								<span key={file}>{file}</span>
							))}
						</div>
					}
				>
					<span className='inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-foreground/80'>
						<FileText className='size-3' />
						{changedFiles.length} context files changed
					</span>
				</SimpleTooltip>
			)}
		</div>
	);
}
