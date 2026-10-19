import { ArrowDownRight, ArrowUpRight, Loader2, Minus } from 'lucide-react';

import type { TestRun } from '@/lib/context-tests';
import { formatPassRate } from '@/lib/context-tests';
import { cn } from '@/lib/utils';

export function RunDots({ results, total, className }: { results: boolean[]; total?: number; className?: string }) {
	const pendingCount = Math.max((total ?? results.length) - results.length, 0);
	return (
		<span
			className={cn('inline-flex items-center gap-0.5', className)}
			aria-label={`${results.filter(Boolean).length} of ${results.length} runs passed`}
		>
			{results.map((passed, index) => (
				<span
					key={index}
					className={cn('size-2 rounded-full', passed ? 'bg-emerald-500' : 'bg-red-500 dark:bg-red-400')}
				/>
			))}
			{Array.from({ length: pendingCount }, (_, index) => (
				<span key={`pending-${index}`} className='size-2 rounded-full border border-border' />
			))}
		</span>
	);
}

export function BaselineDots({ passes, runs }: { passes: number; runs: number }) {
	const results = Array.from({ length: runs }, (_, index) => index < passes);
	return <RunDots results={results} />;
}

export function RunProgress({ run }: { run: TestRun }) {
	if (run.status === 'done') {
		return <RunDots results={run.results} />;
	}
	return (
		<span className='inline-flex items-center gap-1.5 text-xs text-muted-foreground'>
			{run.status === 'running' ? <Loader2 className='size-3 animate-spin' /> : null}
			{run.status === 'running' ? 'Running' : 'Queued'}
		</span>
	);
}

export function PassRateDelta({ before, after }: { before: number | null; after: number | null }) {
	if (before === null || after === null) {
		return null;
	}
	const points = Math.round((after - before) * 100);
	if (points === 0) {
		return (
			<span className='inline-flex items-center gap-0.5 text-xs text-muted-foreground'>
				<Minus className='size-3' />
				same
			</span>
		);
	}
	const isImprovement = points > 0;
	const Icon = isImprovement ? ArrowUpRight : ArrowDownRight;
	return (
		<span
			className={cn(
				'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
				isImprovement ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
			)}
		>
			<Icon className='size-3' />
			{isImprovement ? '+' : ''}
			{points} pts
		</span>
	);
}

export function PassRateLabel({ rate, className }: { rate: number | null; className?: string }) {
	return (
		<span
			className={cn(
				'text-xs font-medium tabular-nums',
				className,
				rate === null && 'text-muted-foreground',
				rate !== null && rate >= 0.99 && 'text-emerald-600 dark:text-emerald-400',
				rate !== null && rate < 0.99 && rate >= 0.6 && 'text-amber-600 dark:text-amber-400',
				rate !== null && rate < 0.6 && 'text-red-600 dark:text-red-400',
			)}
		>
			{formatPassRate(rate)}
		</span>
	);
}

export function TagChip({
	tag,
	isActive = false,
	onClick,
}: {
	tag: string;
	isActive?: boolean;
	onClick?: (tag: string) => void;
}) {
	const className = cn(
		'inline-flex h-5 items-center rounded-md border px-1.5 text-[11px] leading-none',
		isActive ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-muted/40 text-muted-foreground',
		onClick && 'cursor-pointer hover:border-primary/40 hover:text-foreground',
	);
	if (!onClick) {
		return <span className={className}>{tag}</span>;
	}
	return (
		<button type='button' className={className} onClick={() => onClick(tag)}>
			{tag}
		</button>
	);
}
