import { Checkbox } from '@/components/ui/checkbox';

interface UserGroupCheckboxRowProps {
	id: string;
	label: string;
	description: string;
	checked: boolean;
	disabled?: boolean;
	onCheckedChange: (checked: boolean) => void;
}

export function UserGroupCheckboxRow({
	id,
	label,
	description,
	checked,
	disabled,
	onCheckedChange,
}: UserGroupCheckboxRowProps) {
	return (
		<div className='flex items-start gap-3 rounded-lg border p-3'>
			<Checkbox
				id={id}
				className='mt-0.5'
				checked={checked}
				disabled={disabled}
				onCheckedChange={(state) => onCheckedChange(state === true)}
			/>
			<div>
				<label htmlFor={id} className='cursor-pointer text-sm font-medium'>
					{label}
				</label>
				<p className='text-xs text-muted-foreground'>{description}</p>
			</div>
		</div>
	);
}
