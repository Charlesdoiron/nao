import { cn } from '@/lib/utils';

export function ReliabilityValue({ rate, className }: { rate: number | null; className?: string }) {
	if (rate === null) {
		return <span className={cn('text-xs text-muted-foreground', className)}>No runs yet</span>;
	}
	return (
		<span className={cn('text-sm font-medium tabular-nums', reliabilityTextClass(rate), className)}>
			{formatPercent(rate)}
		</span>
	);
}

export function formatPercent(rate: number): string {
	return `${Math.round(rate * 100)}%`;
}

export function reliabilityTextClass(rate: number): string {
	if (rate >= 0.9) {
		return 'text-green-600 dark:text-green-500';
	}
	if (rate >= 0.7) {
		return 'text-amber-600 dark:text-amber-500';
	}
	return 'text-destructive';
}
