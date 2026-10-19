import type { DatePresetId } from '@/lib/story-controls';
import { DATE_PRESETS } from '@/lib/story-controls';
import { cn } from '@/lib/utils';

export function StoryDatePresetChips({
	value,
	onChange,
	includeCustom = true,
	size = 'default',
}: {
	value: DatePresetId | null;
	onChange: (preset: DatePresetId) => void;
	includeCustom?: boolean;
	size?: 'default' | 'small';
}) {
	const presets = includeCustom ? DATE_PRESETS : DATE_PRESETS.filter((preset) => preset.id !== 'custom');

	return (
		<div role='radiogroup' aria-label='Date range' className='flex flex-wrap gap-1.5'>
			{presets.map((preset) => {
				const isSelected = value === preset.id;
				return (
					<button
						key={preset.id}
						type='button'
						role='radio'
						aria-checked={isSelected}
						onClick={() => onChange(preset.id)}
						className={cn(
							'cursor-pointer rounded-full border font-medium transition-colors',
							size === 'small' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
							isSelected
								? 'border-foreground bg-foreground text-background'
								: 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
						)}
					>
						{preset.label}
					</button>
				);
			})}
		</div>
	);
}
