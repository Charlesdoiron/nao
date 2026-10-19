import { Check } from 'lucide-react';
import { Fragment } from 'react';

import { cn } from '@/lib/utils';

export type TestFlowStep = 'target' | 'questions' | 'runs' | 'review';

export const testFlowSteps: { id: TestFlowStep; label: string; hint: string }[] = [
	{ id: 'target', label: 'Choose context', hint: 'Production, branch or tag' },
	{ id: 'questions', label: 'Pick questions', hint: 'Filter, select or add' },
	{ id: 'runs', label: 'Set runs', hint: 'How many times each' },
	{ id: 'review', label: 'Run & review', hint: 'Reliability and failures' },
];

interface ContextTestsStepperProps {
	activeStep: TestFlowStep;
	reachableSteps: TestFlowStep[];
	onStepChange: (step: TestFlowStep) => void;
}

export function ContextTestsStepper({ activeStep, reachableSteps, onStepChange }: ContextTestsStepperProps) {
	const activeIndex = testFlowSteps.findIndex((step) => step.id === activeStep);

	return (
		<ol className='flex items-center gap-2'>
			{testFlowSteps.map((step, index) => {
				const isActive = index === activeIndex;
				const isDone = index < activeIndex;
				const isReachable = reachableSteps.includes(step.id) && !isActive;
				return (
					<Fragment key={step.id}>
						{index > 0 && (
							<li
								aria-hidden
								className={cn('h-px flex-1 bg-border', isDone || isActive ? 'bg-primary/40' : '')}
							/>
						)}
						<li>
							<button
								type='button'
								disabled={!isReachable}
								onClick={() => onStepChange(step.id)}
								aria-current={isActive ? 'step' : undefined}
								className={cn(
									'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
									isReachable && 'cursor-pointer hover:bg-accent',
									!isReachable && !isActive && 'cursor-default',
								)}
							>
								<span
									className={cn(
										'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
										isActive && 'bg-primary text-primary-foreground',
										isDone && 'bg-primary/15 text-primary',
										!isActive && !isDone && 'bg-muted text-muted-foreground',
									)}
								>
									{isDone ? <Check className='size-3.5' /> : index + 1}
								</span>
								<span className='flex flex-col'>
									<span
										className={cn(
											'text-sm font-medium leading-5',
											isActive || isDone ? 'text-foreground' : 'text-muted-foreground',
										)}
									>
										{step.label}
									</span>
									<span className='text-[11px] leading-4 text-muted-foreground'>{step.hint}</span>
								</span>
							</button>
						</li>
					</Fragment>
				);
			})}
		</ol>
	);
}
