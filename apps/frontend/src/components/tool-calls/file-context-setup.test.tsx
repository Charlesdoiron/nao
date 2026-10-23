// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FileContextSetup } from './file-context-setup';

afterEach(cleanup);

describe('FileContextSetup', () => {
	it('adds and removes Markdown and text files', () => {
		render(<ControlledFileContextSetup />);
		const file = new File(['Company notes'], 'company.txt', { type: 'text/plain' });

		fireEvent.change(screen.getByLabelText('Upload business context files'), {
			target: { files: [file] },
		});

		expect(screen.getByText('company.txt')).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Remove company.txt' }));
		expect(screen.queryByText('company.txt')).toBeNull();
	});

	it('rejects unsupported files before adding them', () => {
		render(<ControlledFileContextSetup />);
		const file = new File(['PDF'], 'company.pdf', { type: 'application/pdf' });

		fireEvent.change(screen.getByLabelText('Upload business context files'), {
			target: { files: [file] },
		});

		expect(screen.getByText('company.pdf must be a Markdown or text file.')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Remove company.pdf' })).toBeNull();
	});

	it('accepts files dropped onto the source card', () => {
		const onFilesChange = vi.fn();
		render(<FileContextSetup files={[]} disabled={false} error={null} onFilesChange={onFilesChange} />);
		const file = new File(['# Handbook'], 'handbook.md', { type: 'text/markdown' });

		fireEvent.drop(screen.getByRole('heading', { name: 'Files' }).closest('section')!, {
			dataTransfer: { files: [file] },
		});

		expect(onFilesChange).toHaveBeenCalledWith([file]);
	});

	it('keeps at most ten selected files', () => {
		render(<ControlledFileContextSetup />);
		const files = Array.from(
			{ length: 11 },
			(_, index) => new File([`${index}`], `context-${index + 1}.txt`, { type: 'text/plain' }),
		);

		fireEvent.change(screen.getByLabelText('Upload business context files'), {
			target: { files },
		});

		expect(screen.getByText('You can upload up to 10 business context files.')).toBeTruthy();
		expect(screen.getByText('context-10.txt')).toBeTruthy();
		expect(screen.queryByText('context-11.txt')).toBeNull();
	});
});

function ControlledFileContextSetup() {
	const [files, setFiles] = useState<File[]>([]);
	return <FileContextSetup files={files} disabled={false} error={null} onFilesChange={setFiles} />;
}
