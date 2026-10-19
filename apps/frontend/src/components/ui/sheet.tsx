import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

function Sheet({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
	return <DialogPrimitive.Root data-slot='sheet' {...props} />;
}

function SheetContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
	return (
		<DialogPrimitive.Portal>
			<DialogPrimitive.Overlay
				data-slot='sheet-overlay'
				className='data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/20'
			/>
			<DialogPrimitive.Content
				data-slot='sheet-content'
				className={cn(
					'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l shadow-xl duration-200 outline-none sm:max-w-md',
					className,
				)}
				{...props}
			>
				{children}
				<DialogPrimitive.Close className='absolute top-4 right-4 cursor-pointer rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:outline-hidden'>
					<XIcon className='size-4' />
					<span className='sr-only'>Close</span>
				</DialogPrimitive.Close>
			</DialogPrimitive.Content>
		</DialogPrimitive.Portal>
	);
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div data-slot='sheet-header' className={cn('flex flex-col gap-1 border-b p-4 pr-10', className)} {...props} />
	);
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
	return (
		<DialogPrimitive.Title
			data-slot='sheet-title'
			className={cn('text-base font-semibold', className)}
			{...props}
		/>
	);
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
	return (
		<DialogPrimitive.Description
			data-slot='sheet-description'
			className={cn('text-muted-foreground text-xs', className)}
			{...props}
		/>
	);
}

export { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle };
