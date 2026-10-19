import { formatPercent } from './test-suite-utils';
import type { TestStatus } from './test-suite-types';

import { cn } from '@/lib/utils';

export interface SuiteSummary {
	baselineRate: number | null;
	candidateRate: number | null;
	statusCounts: Record<TestStatus, number>;
	isComparing: boolean;
	candidateName: string;
}

export function TestSuiteSummary({
	summary,
	activeStatus,
	onStatusSelect,
}: {
	summary: SuiteSummary;
	activeStatus: TestStatus | 'all';
	onStatusSelect: (status: TestStatus | 'all') => void;
}) {
	const delta =
		summary.baselineRate !== null && summary.candidateRate !== null
			? Math.round((summary.candidateRate - summary.baselineRate) * 100)
			: null;

	return (
		<div className='grid grid-cols-2 gap-3 lg:grid-cols-5'>
			<div className='col-span-2 rounded-xl border bg-background/60 px-4 py-3 shadow-xs'>
				<p className='text-xs text-muted-foreground'>Suite reliability · share of passing runs</p>
				<div className='mt-1.5 flex items-end gap-5'>
					<RateFigure label='Production' rate={summary.baselineRate} />
					{summary.isComparing && (
						<>
							<RateFigure label={summary.candidateName} rate={summary.candidateRate} mono />
							{delta !== null && delta !== 0 && (
								<span
									className={cn(
										'mb-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
										delta > 0
											? 'bg-green-500/10 text-green-600 dark:text-green-400'
											: 'bg-red-500/10 text-red-600 dark:text-red-400',
									)}
								>
									{delta > 0 ? '+' : '−'}
									{Math.abs(delta)} pts
								</span>
							)}
						</>
					)}
				</div>
			</div>
			<StatusCard
				label='Regressed'
				hint='Lower pass rate than production'
				count={summary.statusCounts.regressed}
				tone='red'
				status='regressed'
				activeStatus={activeStatus}
				onSelect={onStatusSelect}
				hidden={!summary.isComparing}
			/>
			<StatusCard
				label='Flaky'
				hint='Pass some runs, fail others'
				count={summary.statusCounts.flaky}
				tone='amber'
				status='flaky'
				activeStatus={activeStatus}
				onSelect={onStatusSelect}
			/>
			<StatusCard
				label='Not run'
				hint={summary.isComparing ? 'No results on this branch yet' : 'No results yet'}
				count={summary.statusCounts['not-run']}
				tone='muted'
				status='not-run'
				activeStatus={activeStatus}
				onSelect={onStatusSelect}
			/>
		</div>
	);
}

function RateFigure({ label, rate, mono = false }: { label: string; rate: number | null; mono?: boolean }) {
	return (
		<div className='min-w-0'>
			<p className='text-2xl font-semibold tabular-nums tracking-tight'>{formatPercent(rate)}</p>
			<p className={cn('truncate text-xs text-muted-foreground', mono && 'font-mono')}>{label}</p>
		</div>
	);
}

function StatusCard({
	label,
	hint,
	count,
	tone,
	status,
	activeStatus,
	onSelect,
	hidden = false,
}: {
	label: string;
	hint: string;
	count: number;
	tone: 'red' | 'amber' | 'muted';
	status: TestStatus;
	activeStatus: TestStatus | 'all';
	onSelect: (status: TestStatus | 'all') => void;
	hidden?: boolean;
}) {
	if (hidden) {
		return <div className='hidden lg:block' />;
	}
	const isActive = activeStatus === status;
	return (
		<button
			type='button'
			onClick={() => onSelect(isActive ? 'all' : status)}
			className={cn(
				'flex cursor-pointer flex-col items-start rounded-xl border bg-background/60 px-4 py-3 text-left shadow-xs transition-colors hover:bg-muted/40',
				isActive && 'border-foreground/30 bg-muted/50',
			)}
		>
			<span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
				<span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} />
				{label}
			</span>
			<span className='mt-1.5 text-2xl font-semibold tabular-nums tracking-tight'>{count}</span>
			<span className='text-xs text-muted-foreground'>{hint}</span>
		</button>
	);
}

const TONE_DOT = {
	red: 'bg-red-500',
	amber: 'bg-amber-500',
	muted: 'bg-muted-foreground/50',
};
