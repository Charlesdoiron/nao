import { formatPercent, getPassRate, STATUS_LABELS } from './test-suite-utils';
import type { TargetResult, TestStatus } from './test-suite-types';

import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function TestRateCell({
	result,
	isRunning,
	runsPerTest,
	unavailableLabel,
}: {
	result: TargetResult | undefined;
	isRunning: boolean;
	runsPerTest: number;
	unavailableLabel?: string;
}) {
	if (unavailableLabel) {
		return <span className='text-xs text-muted-foreground/70 italic'>{unavailableLabel}</span>;
	}

	if (isRunning) {
		return (
			<div className='flex items-center gap-2'>
				<RunDots outcomes={Array.from({ length: runsPerTest }, () => 'running' as const)} />
				<span className='text-xs text-muted-foreground'>Running</span>
			</div>
		);
	}

	const rate = getPassRate(result);
	if (!result || rate === null) {
		return <span className='text-xs text-muted-foreground/70'>Not run</span>;
	}

	const passes = result.runs.filter((run) => run.outcome === 'pass').length;
	return (
		<SimpleTooltip content={`${passes} of ${result.runs.length} runs passed`}>
			<div className='flex items-center gap-2'>
				<RunDots outcomes={result.runs.map((run) => run.outcome)} />
				<span className={cn('text-sm tabular-nums font-medium', rateColor(rate))}>{formatPercent(rate)}</span>
			</div>
		</SimpleTooltip>
	);
}

export function RunDots({ outcomes }: { outcomes: Array<'pass' | 'fail' | 'running'> }) {
	return (
		<div className='flex items-center gap-1'>
			{outcomes.map((outcome, index) => (
				<span
					key={index}
					className={cn(
						'size-2 rounded-full',
						outcome === 'pass' && 'bg-green-500',
						outcome === 'fail' && 'bg-red-500',
						outcome === 'running' && 'bg-muted-foreground/40 animate-pulse',
					)}
				/>
			))}
		</div>
	);
}

export function RateDelta({ delta }: { delta: number | null }) {
	if (delta === null || delta === 0) {
		return <span className='text-xs text-muted-foreground/70'>—</span>;
	}
	return (
		<span
			className={cn(
				'text-xs font-medium tabular-nums',
				delta > 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500',
			)}
		>
			{delta > 0 ? '+' : '−'}
			{Math.abs(delta)} pts
		</span>
	);
}

export function TestStatusBadge({ status }: { status: TestStatus }) {
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
				STATUS_STYLES[status],
			)}
		>
			<span className={cn('size-1.5 rounded-full', STATUS_DOT_STYLES[status])} />
			{STATUS_LABELS[status]}
		</span>
	);
}

const STATUS_STYLES: Record<TestStatus, string> = {
	regressed: 'bg-red-500/10 text-red-600 dark:text-red-400',
	improved: 'bg-green-500/10 text-green-600 dark:text-green-400',
	flaky: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
	failing: 'bg-red-500/5 text-red-600/90 dark:text-red-400/90',
	passing: 'bg-muted text-foreground/80',
	'not-run': 'bg-muted/60 text-muted-foreground',
};

const STATUS_DOT_STYLES: Record<TestStatus, string> = {
	regressed: 'bg-red-500',
	improved: 'bg-green-500',
	flaky: 'bg-amber-500',
	failing: 'bg-red-400',
	passing: 'bg-green-500',
	'not-run': 'bg-muted-foreground/50',
};

function rateColor(rate: number): string {
	if (rate === 1) {
		return 'text-foreground';
	}
	if (rate === 0) {
		return 'text-red-600 dark:text-red-500';
	}
	return 'text-amber-700 dark:text-amber-500';
}
