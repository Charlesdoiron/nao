import { CheckCircle2, FileCode2, Loader2, Pencil, Play, X, XCircle } from 'lucide-react';

import { RunDots, TestStatusBadge } from './test-rate-cell';
import { formatPercent, getPassRate, toTestFilePath } from './test-suite-utils';
import type { GitRef, SuiteTest, TargetResult, TestStatus } from './test-suite-types';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useTimeAgo } from '@/hooks/use-time-ago';
import { cn } from '@/lib/utils';

export function TestDetailPanel({
	test,
	status,
	baselineRef,
	candidateRef,
	isRunning,
	runsPerTest,
	onClose,
	onRun,
	onEdit,
	onRemoveTag,
}: {
	test: SuiteTest;
	status: TestStatus;
	baselineRef: GitRef;
	candidateRef: GitRef;
	isRunning: (testId: string, refId: string) => boolean;
	runsPerTest: number;
	onClose: () => void;
	onRun: () => void;
	onEdit: () => void;
	onRemoveTag: (tag: string) => void;
}) {
	const isComparing = baselineRef.id !== candidateRef.id;
	const targets = isComparing ? [baselineRef, candidateRef] : [baselineRef];
	const anyRunning = targets.some((ref) => isRunning(test.id, ref.id));

	return (
		<aside className='fixed inset-y-0 right-0 z-30 flex w-full max-w-[460px] flex-col border-l bg-background shadow-2xl animate-in slide-in-from-right duration-200'>
			<header className='flex items-start gap-3 border-b px-5 py-4'>
				<div className='min-w-0 flex-1'>
					<div className='flex items-center gap-2'>
						<h2 className='truncate font-mono text-sm font-semibold'>{test.name}</h2>
						<TestStatusBadge status={status} />
					</div>
					<p className='mt-1 flex items-center gap-1 font-mono text-xs text-muted-foreground'>
						<FileCode2 className='size-3' />
						{toTestFilePath(test.name)}
					</p>
				</div>
				<Button variant='ghost-muted' size='icon-sm' onClick={onClose} aria-label='Close'>
					<X />
				</Button>
			</header>

			<div className='flex-1 space-y-6 overflow-y-auto px-5 py-5'>
				<section>
					<p className='text-xs text-muted-foreground'>Question</p>
					<p className='mt-1 text-[15px] leading-snug'>{test.prompt}</p>
					<div className='mt-3 flex flex-wrap items-center gap-2'>
						<span className='inline-flex items-center gap-1.5 text-xs'>
							<Avatar username={test.owner} className='size-5 text-[9px]' />
							{test.owner}
						</span>
						<span className='text-muted-foreground/50'>·</span>
						{test.tags.map((tag) => (
							<span
								key={tag}
								className='group/tag inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground/80'
							>
								{tag}
								<button
									type='button'
									onClick={() => onRemoveTag(tag)}
									className='hidden cursor-pointer text-muted-foreground hover:text-foreground group-hover/tag:inline'
									aria-label={`Remove ${tag}`}
								>
									<X className='size-3' />
								</button>
							</span>
						))}
					</div>
				</section>

				<section>
					<div className='mb-2 flex items-center justify-between'>
						<p className='text-xs text-muted-foreground'>Results</p>
						<p className='text-xs text-muted-foreground'>Each dot is one run</p>
					</div>
					<div className={cn('grid gap-3', isComparing && 'grid-cols-2')}>
						{targets.map((ref) => (
							<TargetResultCard
								key={ref.id}
								label={ref.isProduction ? 'Production' : ref.name}
								isBranch={!ref.isProduction}
								result={test.results[ref.id]}
								isRunning={isRunning(test.id, ref.id)}
								runsPerTest={runsPerTest}
							/>
						))}
					</div>
				</section>

				<section>
					<p className='mb-2 text-xs text-muted-foreground'>Expected SQL</p>
					<pre className='overflow-x-auto rounded-lg bg-muted/50 p-3 font-mono text-xs leading-relaxed'>
						{test.sql}
					</pre>
				</section>
			</div>

			<footer className='flex items-center gap-2 border-t px-5 py-3'>
				<Button variant='outline' size='sm' onClick={onEdit}>
					<Pencil />
					Edit
				</Button>
				<Button variant='primary-gradient' size='sm' className='ml-auto' onClick={onRun} isLoading={anyRunning}>
					{!anyRunning && <Play />}
					Run {runsPerTest}× {isComparing ? 'on both' : ''}
				</Button>
			</footer>
		</aside>
	);
}

function TargetResultCard({
	label,
	isBranch,
	result,
	isRunning,
	runsPerTest,
}: {
	label: string;
	isBranch: boolean;
	result: TargetResult | undefined;
	isRunning: boolean;
	runsPerTest: number;
}) {
	const rate = getPassRate(result);
	const ranAgo = useTimeAgo(result?.ranAt ?? 0);

	return (
		<div className='min-w-0 rounded-xl border p-3'>
			<p className={cn('truncate text-xs text-muted-foreground', isBranch && 'font-mono')}>{label}</p>
			{isRunning ? (
				<div className='mt-2 flex items-center gap-2'>
					<Loader2 className='size-4 animate-spin text-muted-foreground' />
					<RunDots outcomes={Array.from({ length: runsPerTest }, () => 'running' as const)} />
				</div>
			) : result ? (
				<>
					<div className='mt-1 flex items-center gap-2'>
						<span className='text-xl font-semibold tabular-nums'>{formatPercent(rate)}</span>
						<RunDots outcomes={result.runs.map((run) => run.outcome)} />
					</div>
					<p className='text-[11px] text-muted-foreground'>{ranAgo.humanReadable}</p>
					<ol className='mt-3 space-y-2'>
						{result.runs.map((run, index) => (
							<li key={index} className='flex gap-2 text-xs'>
								{run.outcome === 'pass' ? (
									<CheckCircle2 className='mt-px size-3.5 shrink-0 text-green-500' />
								) : (
									<XCircle className='mt-px size-3.5 shrink-0 text-red-500' />
								)}
								<div className='min-w-0'>
									<p>
										Run {index + 1}{' '}
										<span className='text-muted-foreground tabular-nums'>
											· {run.durationSeconds}s
										</span>
									</p>
									{run.reason && <p className='text-muted-foreground'>{run.reason}</p>}
								</div>
							</li>
						))}
					</ol>
				</>
			) : (
				<p className='mt-2 text-sm text-muted-foreground'>Not run yet</p>
			)}
		</div>
	);
}
