// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAllWarehouseTableKeys, WarehouseTableSelection } from './warehouse-table-selection';
import type { WarehouseSchemaInventory } from './warehouse-table-selection';

const schemas: WarehouseSchemaInventory[] = [
	{ schema: 'public', tables: ['customers', 'orders'] },
	{ schema: 'warehouse', tables: ['events'] },
];

afterEach(cleanup);

describe('WarehouseTableSelection', () => {
	it('starts with every table selected and supports table, schema, and bulk selection', () => {
		const onSubmit = vi.fn();
		render(<SelectionHarness onSubmit={onSubmit} />);

		expect(screen.getByText('3 of 3 selected')).toBeTruthy();
		fireEvent.click(screen.getByRole('checkbox', { name: 'Select public.orders' }));
		expect(screen.getByText('2 of 3 selected')).toBeTruthy();
		expect(screen.getByRole('checkbox', { name: 'Select all tables in public' }).dataset.state).toBe(
			'indeterminate',
		);

		fireEvent.click(screen.getByRole('checkbox', { name: 'Select all tables in public' }));
		expect(screen.getByText('3 of 3 selected')).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
		expect(screen.getByText('0 of 3 selected')).toBeTruthy();
		expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);

		fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
		fireEvent.click(screen.getByRole('button', { name: 'Next' }));
		expect(onSubmit).toHaveBeenCalledOnce();
	});

	it('filters schemas and tables without changing the selection', () => {
		render(<SelectionHarness onSubmit={vi.fn()} />);

		fireEvent.change(screen.getByRole('textbox', { name: 'Search schemas and tables' }), {
			target: { value: 'events' },
		});

		expect(screen.getByText('events')).toBeTruthy();
		expect(screen.queryByText('orders')).toBeNull();
		expect(screen.getByText('3 of 3 selected')).toBeTruthy();
	});

	it('collapses and expands a schema from the arrow beside its name', () => {
		render(<SelectionHarness onSubmit={vi.fn()} />);

		fireEvent.click(screen.getByRole('button', { name: 'Collapse public schema' }));
		expect(screen.queryByText('customers')).toBeNull();
		expect(screen.queryByText('orders')).toBeNull();

		fireEvent.click(screen.getByRole('button', { name: 'Expand public schema' }));
		expect(screen.getByText('customers')).toBeTruthy();
		expect(screen.getByText('orders')).toBeTruthy();
	});
});

function SelectionHarness({ onSubmit }: { onSubmit: () => void }) {
	const [selectedTableKeys, setSelectedTableKeys] = useState(() => getAllWarehouseTableKeys(schemas));

	return (
		<WarehouseTableSelection
			schemas={schemas}
			selectedTableKeys={selectedTableKeys}
			isPending={false}
			error={null}
			onChange={setSelectedTableKeys}
			onBack={vi.fn()}
			onSubmit={onSubmit}
		/>
	);
}
