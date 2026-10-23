import {
	BUSINESS_CONTEXT_FILE_ACCEPT,
	BUSINESS_CONTEXT_FILE_EXTENSIONS,
	documentExtension,
	MAX_BUSINESS_CONTEXT_FILES,
	MAX_BUSINESS_CONTEXT_FILE_SIZE_MB,
	MAX_BUSINESS_CONTEXT_TOTAL_SIZE_MB,
} from '@nao/shared/attachments';
import { FileText, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { DragEvent } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-fields';
import { cn } from '@/lib/utils';

interface FileContextSetupProps {
	files: File[];
	disabled: boolean;
	error: string | null;
	onFilesChange: (files: File[]) => void;
}

export function FileContextSetup({ files, disabled, error, onFilesChange }: FileContextSetupProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [rejection, setRejection] = useState<string | null>(null);

	const addFiles = (candidates: FileList | File[]) => {
		const nextFiles = [...files];
		const fingerprints = new Set(files.map(fileFingerprint));
		let totalSize = files.reduce((total, file) => total + file.size, 0);
		let nextRejection: string | null = null;

		for (const file of Array.from(candidates)) {
			const problem = validateFile(file);
			if (problem) {
				nextRejection = problem;
				continue;
			}
			const fingerprint = fileFingerprint(file);
			if (fingerprints.has(fingerprint)) {
				continue;
			}
			if (nextFiles.length >= MAX_BUSINESS_CONTEXT_FILES) {
				nextRejection = `You can upload up to ${MAX_BUSINESS_CONTEXT_FILES} business context files.`;
				continue;
			}
			if (totalSize + file.size > MAX_BUSINESS_CONTEXT_TOTAL_SIZE_MB * 1024 * 1024) {
				nextRejection = `Business context files cannot exceed ${MAX_BUSINESS_CONTEXT_TOTAL_SIZE_MB} MB in total.`;
				continue;
			}
			fingerprints.add(fingerprint);
			nextFiles.push(file);
			totalSize += file.size;
		}

		setRejection(nextRejection);
		onFilesChange(nextFiles);
	};

	const handleDrop = (event: DragEvent<HTMLElement>) => {
		event.preventDefault();
		setIsDragging(false);
		if (!disabled) {
			addFiles(event.dataTransfer.files);
		}
	};

	return (
		<section
			className={cn(
				'space-y-4 rounded-xl border bg-muted/20 p-4 transition-colors',
				isDragging && 'border-primary bg-primary/5',
			)}
			onDragEnter={(event) => {
				event.preventDefault();
				if (!disabled) {
					setIsDragging(true);
				}
			}}
			onDragOver={(event) => {
				event.preventDefault();
			}}
			onDragLeave={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
					setIsDragging(false);
				}
			}}
			onDrop={handleDrop}
		>
			<div className='flex items-center gap-3'>
				<div className='flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background shadow-xs'>
					<Upload className='size-5 text-muted-foreground' aria-hidden />
				</div>
				<div className='min-w-0 flex-1'>
					<div className='flex items-center gap-2'>
						<h3 className='text-sm font-medium'>Files</h3>
						<Badge variant='secondary' className='h-5 px-1.5 text-[10px] font-normal'>
							Optional
						</Badge>
					</div>
					<p className='text-xs text-muted-foreground'>Add Markdown or text documents as business context.</p>
				</div>
				<Button
					type='button'
					variant='outline'
					size='sm'
					onClick={() => inputRef.current?.click()}
					disabled={disabled}
				>
					Add files
				</Button>
				<input
					ref={inputRef}
					type='file'
					accept={BUSINESS_CONTEXT_FILE_ACCEPT}
					multiple
					disabled={disabled}
					aria-label='Upload business context files'
					className='sr-only'
					onChange={(event) => {
						if (event.target.files) {
							addFiles(event.target.files);
						}
						event.target.value = '';
					}}
				/>
			</div>

			<div
				className={cn(
					'rounded-lg border border-dashed px-4 py-3 text-center text-xs text-muted-foreground',
					isDragging && 'border-primary text-foreground',
				)}
			>
				{isDragging ? 'Drop files here' : 'Drop .md or .txt files here'}
				<span className='ml-1 text-muted-foreground/70'>
					· {MAX_BUSINESS_CONTEXT_FILE_SIZE_MB} MB each · {MAX_BUSINESS_CONTEXT_FILES} files /{' '}
					{MAX_BUSINESS_CONTEXT_TOTAL_SIZE_MB} MB total
				</span>
			</div>

			{files.length > 0 && (
				<ul className='space-y-2'>
					{files.map((file) => (
						<li
							key={fileFingerprint(file)}
							className='flex items-center gap-3 rounded-lg border bg-background px-3 py-2'
						>
							<FileText className='size-4 shrink-0 text-muted-foreground' aria-hidden />
							<div className='min-w-0 flex-1'>
								<p className='truncate text-sm font-medium'>{file.name}</p>
								<p className='text-[11px] text-muted-foreground'>{formatFileSize(file.size)}</p>
							</div>
							<Button
								type='button'
								variant='ghost'
								size='icon-xs'
								aria-label={`Remove ${file.name}`}
								disabled={disabled}
								onClick={() => onFilesChange(files.filter((candidate) => candidate !== file))}
							>
								<X aria-hidden />
							</Button>
						</li>
					))}
				</ul>
			)}

			{(rejection || error) && <FormError error={rejection ?? error ?? ''} />}
		</section>
	);
}

function validateFile(file: File): string | null {
	const extension = documentExtension(file.name);
	if (!extension || !(BUSINESS_CONTEXT_FILE_EXTENSIONS as readonly string[]).includes(extension)) {
		return `${file.name} must be a Markdown or text file.`;
	}
	if (file.size > MAX_BUSINESS_CONTEXT_FILE_SIZE_MB * 1024 * 1024) {
		return `${file.name} is larger than the ${MAX_BUSINESS_CONTEXT_FILE_SIZE_MB} MB upload limit.`;
	}
	return null;
}

function fileFingerprint(file: File): string {
	return `${file.name}:${file.size}:${file.lastModified}`;
}

function formatFileSize(bytes: number): string {
	return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
}
