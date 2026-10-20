import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

import { NyanCat } from '@/components/icons/nyan-cat';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const TRIAL_CREDITS = 20;
const COUNT_UP_DURATION_MS = 900;
const CONFETTI_COLORS = [
	'var(--chart-1)',
	'var(--chart-2)',
	'var(--chart-3)',
	'var(--chart-4)',
	'var(--chart-5)',
	'var(--chart-6)',
	'var(--chart-7)',
];
const CONFETTI_COUNT = 14;

interface TrialStartedDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	userName?: string | null;
}

export function TrialStartedDialog({ open, onOpenChange, userName }: TrialStartedDialogProps) {
	const firstName = userName?.trim().split(/\s+/)[0];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent showCloseButton={false} className='overflow-hidden border-violet/20 p-0 sm:max-w-xl'>
				<NyanCatSky />
				<div className='flex flex-col items-center px-8 pb-8 text-center sm:px-12'>
					<span
						className={cn(enterClass, 'text-[10px] font-semibold uppercase tracking-[0.18em] text-violet')}
					>
						{firstName ? `You’re in, ${firstName}` : 'You’re in'}
					</span>
					<DialogHeader className='mt-3 items-center gap-3'>
						<DialogTitle
							className={cn(
								enterClass,
								'[animation-delay:80ms] font-borna text-3xl font-medium tracking-tight sm:text-4xl',
							)}
						>
							Welcome to nao Cloud
						</DialogTitle>
						<DialogDescription
							className={cn(enterClass, '[animation-delay:160ms] max-w-md text-center leading-relaxed')}
						>
							We’ve added ${TRIAL_CREDITS} of credits so your team can start asking questions right away.
						</DialogDescription>
					</DialogHeader>
					<div className={cn(enterClass, '[animation-delay:260ms] relative my-8 flex flex-col items-center')}>
						<ConfettiBurst delayMs={COUNT_UP_DURATION_MS - 150} />
						<span className='relative font-borna text-6xl font-medium tracking-tight text-violet tabular-nums'>
							$<CountUp to={TRIAL_CREDITS} durationMs={COUNT_UP_DURATION_MS} />
						</span>
						<span className='relative mt-1 text-sm font-medium text-foreground'>
							Free credits, ready to use
						</span>
					</div>
					<Button
						asChild
						variant='primary-gradient'
						size='lg'
						className={cn(enterClass, '[animation-delay:380ms] group rounded-full px-8')}
					>
						<Link to='/' onClick={() => onOpenChange(false)}>
							Ask your first question
							<ArrowRight className='size-4 transition-transform group-hover:translate-x-0.5' />
						</Link>
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

const enterClass = 'animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500';

function NyanCatSky() {
	return (
		<div aria-hidden='true' className='relative h-16 overflow-hidden sm:h-20'>
			<div className='nyan-cat-flight absolute bottom-0 left-0 top-3 flex w-full items-center [--cat-width:7rem]'>
				<NyanCat className='h-auto w-[var(--cat-width)] shrink-0' />
			</div>
		</div>
	);
}

function ConfettiBurst({ delayMs }: { delayMs: number }) {
	return (
		<div aria-hidden='true' className='pointer-events-none absolute left-1/2 top-1/2'>
			{Array.from({ length: CONFETTI_COUNT }, (_, index) => {
				const style = {
					'--angle': `${(360 / CONFETTI_COUNT) * index}deg`,
					'--distance': `${70 + (index % 3) * 18}px`,
					'--delay': `${delayMs + (index % 4) * 40}ms`,
					backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
				} as CSSProperties;
				return (
					<span
						key={index}
						style={style}
						className={cn(
							'confetti-piece absolute -ml-1 -mt-1 size-2',
							index % 2 ? 'rounded-full' : 'rounded-xs',
						)}
					/>
				);
			})}
		</div>
	);
}

function CountUp({ to, durationMs }: { to: number; durationMs: number }) {
	const [value, setValue] = useState(prefersReducedMotion() ? to : 0);

	useEffect(() => {
		if (prefersReducedMotion()) {
			return;
		}
		let frame = 0;
		const start = performance.now();
		const tick = (now: number) => {
			const progress = Math.min((now - start) / durationMs, 1);
			setValue(Math.round(to * easeOutCubic(progress)));
			if (progress < 1) {
				frame = requestAnimationFrame(tick);
			}
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [to, durationMs]);

	return <>{value}</>;
}

function easeOutCubic(t: number): number {
	return 1 - Math.pow(1 - t, 3);
}

function prefersReducedMotion(): boolean {
	return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
