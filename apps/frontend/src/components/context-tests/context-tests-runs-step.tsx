import { Clock, Coins, Repeat } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { COST_PER_RUN_USD, PARALLEL_RUNS, SECONDS_PER_RUN } from '@/components/context-tests/context-tests.mock';
import { cn } from '@/lib/utils';

export const repeatOptions: { value: number; label: string; description: string }[] = [
	{ value: 1, label: 'Quick check', description: 'One answer each. Cannot tell a flaky answer from a broken one.' },
	{ value: 3, label: 'Recommended', description: 'Enough to spot flaky answers at a reasonable cost.' },
	{ value: 5, label: 'Thorough', description: 'Tighter reliability numbers for important questions.' },
	{ value: 10, label: 'Release check', description: 'Before merging large context changes.' },
];

interface ContextTestsRunsStepProps {
	repeats: number;
	questionCount: number;
	onRepeatsChange: (repeats: number) => void;
}

export function ContextTestsRunsStep({ repeats, questionCount, onRepeatsChange }: ContextTestsRunsStepProps) {
	const totalRuns = repeats * questionCount;
	const estimatedMinutes = Math.max(1, Math.ceil((totalRuns * SECONDS_PER_RUN) / PARALLEL_RUNS / 60));

	return (
		<div className='flex flex-col gap-5'>
			<div role='radiogroup' aria-label='Runs per question' className='grid grid-cols-2 gap-3 md:grid-cols-4'>
				{repeatOptions.map((option) => {
					const isSelected = option.value === repeats;
					return (
						<button
							key={option.value}
							type='button'
							role='radio'
							aria-checked={isSelected}
							onClick={() => onRepeatsChange(option.value)}
							className={cn(
								'flex cursor-pointer flex-col gap-1 rounded-xl border p-4 text-left transition-colors',
								isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent/50',
							)}
						>
							<span className='text-2xl font-semibold tabular-nums'>
								{option.value}
								<span className='ml-1 text-sm font-normal text-muted-foreground'>
									{option.value === 1 ? 'run' : 'runs'}
								</span>
							</span>
							<span className='text-sm font-medium'>{option.label}</span>
							<span className='text-xs text-muted-foreground'>{option.description}</span>
						</button>
					);
				})}
			</div>

			<div className='grid grid-cols-3 divide-x rounded-xl border'>
				<RunEstimate
					icon={Repeat}
					label='Agent runs'
					value={String(totalRuns)}
					hint={`${questionCount} questions × ${repeats}`}
				/>
				<RunEstimate
					icon={Coins}
					label='Estimated cost'
					value={`$${(totalRuns * COST_PER_RUN_USD).toFixed(2)}`}
					hint='Charged to the project budget'
				/>
				<RunEstimate
					icon={Clock}
					label='Estimated time'
					value={`~${estimatedMinutes} min`}
					hint={`${PARALLEL_RUNS} runs in parallel`}
				/>
			</div>

			<p className='text-xs text-muted-foreground'>
				A run passes when the data in the agent's answer matches the expected query. Reliability is the share of
				passing runs, compared with the latest production result for the same question.
			</p>
		</div>
	);
}

function RunEstimate({
	icon: Icon,
	label,
	value,
	hint,
}: {
	icon: LucideIcon;
	label: string;
	value: string;
	hint: string;
}) {
	return (
		<div className='flex flex-col gap-1 p-4'>
			<span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
				<Icon className='size-3.5' />
				{label}
			</span>
			<span className='text-xl font-semibold tabular-nums'>{value}</span>
			<span className='text-xs text-muted-foreground'>{hint}</span>
		</div>
	);
}
