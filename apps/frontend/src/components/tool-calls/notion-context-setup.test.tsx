// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NotionContextSetup, parseNotionPages } from './notion-context-setup';
import type { NotionContextValues } from './notion-context-setup';

afterEach(cleanup);

describe('NotionContextSetup', () => {
	it('lets users skip or connect Notion before sync', async () => {
		const onValidate = vi.fn().mockResolvedValue(undefined);
		const onSubmit = vi.fn();
		render(<NotionHarness onValidate={onValidate} onSubmit={onSubmit} />);

		expect(screen.getByRole('button', { name: 'Skip & sync' })).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
		fireEvent.change(screen.getByLabelText('Integration token'), { target: { value: 'secret' } });
		fireEvent.change(screen.getByLabelText('Page or database URLs'), {
			target: { value: 'https://notion.so/company\nhttps://notion.so/metrics' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Connect Notion' }));

		await waitFor(() =>
			expect(onValidate).toHaveBeenCalledWith({
				apiKey: 'secret',
				pagesText: 'https://notion.so/company\nhttps://notion.so/metrics',
			}),
		);
		expect(screen.getByText('Notion connected · 2 pages')).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: 'Sync with context' }));
		expect(onSubmit).toHaveBeenCalledOnce();
	});

	it('normalizes and deduplicates page entries', () => {
		expect(parseNotionPages(' page-one \n\npage-two\r\npage-one ')).toEqual(['page-one', 'page-two']);
	});
});

function NotionHarness({
	onValidate,
	onSubmit,
}: {
	onValidate: (values: NotionContextValues) => Promise<void>;
	onSubmit: () => void;
}) {
	const [values, setValues] = useState<NotionContextValues>({ apiKey: '', pagesText: '' });
	const [validatedFingerprint, setValidatedFingerprint] = useState<string | null>(null);

	return (
		<NotionContextSetup
			values={values}
			validatedFingerprint={validatedFingerprint}
			validatedPages={[
				{ url: 'https://notion.so/company', title: 'Company' },
				{ url: 'https://notion.so/metrics', title: 'Metrics' },
			]}
			isValidating={false}
			isStarting={false}
			canStart={true}
			error={null}
			onValuesChange={setValues}
			onValidatedFingerprintChange={setValidatedFingerprint}
			onValidate={onValidate}
			onBack={vi.fn()}
			onSkip={vi.fn()}
			onSubmit={onSubmit}
		/>
	);
}
