import { ChevronRight, Layers3, Search, Table2 } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormError } from '@/components/ui/form-fields';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface WarehouseSchemaInventory {
	schema: string;
	tables: string[];
}

interface WarehouseTableSelectionProps {
	schemas: WarehouseSchemaInventory[];
	selectedTableKeys: Set<string>;
	isPending: boolean;
	error: { message: string } | null;
	onChange: (selectedTableKeys: Set<string>) => void;
	onBack: () => void;
	onSubmit: () => void;
}

export function WarehouseTableSelection({
	schemas,
	selectedTableKeys,
	isPending,
	error,
	onChange,
	onBack,
	onSubmit,
}: WarehouseTableSelectionProps) {
	const [search, setSearch] = useState('');
	const filteredSchemas = useMemo(() => filterSchemas(schemas, search), [schemas, search]);
	const tableCount = countTables(schemas);
	const selectedCount = selectedTableKeys.size;

	const toggleSchema = (schema: WarehouseSchemaInventory, checked: boolean) => {
		const nextSelection = new Set(selectedTableKeys);
		for (const table of schema.tables) {
			const key = getWarehouseTableKey(schema.schema, table);
			if (checked) {
				nextSelection.add(key);
			} else {
				nextSelection.delete(key);
			}
		}
		onChange(nextSelection);
	};

	const toggleTable = (schema: string, table: string, checked: boolean) => {
		const nextSelection = new Set(selectedTableKeys);
		const key = getWarehouseTableKey(schema, table);
		if (checked) {
			nextSelection.add(key);
		} else {
			nextSelection.delete(key);
		}
		onChange(nextSelection);
	};

	return (
		<div className='flex flex-col gap-5'>
			<section className='space-y-3 rounded-xl border bg-muted/20 p-4'>
				<div>
					<h3 className='text-sm font-medium text-foreground'>Tables to sync</h3>
					<p className='text-[11px] leading-relaxed text-muted-foreground'>
						Only selected tables are added to nao&apos;s context. Warehouse permissions are unchanged.
					</p>
				</div>
				<div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
					<div className='relative min-w-0 flex-1'>
						<Search className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
						<Input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder='Search schemas and tables'
							aria-label='Search schemas and tables'
							className='pl-9'
						/>
					</div>
					<div className='flex items-center justify-between gap-1 sm:justify-start'>
						<span className='mr-1 whitespace-nowrap text-xs text-muted-foreground'>
							{selectedCount} of {tableCount} selected
						</span>
						<Button
							type='button'
							variant='ghost'
							size='sm'
							className='h-8 px-2 text-xs'
							onClick={() => onChange(getAllWarehouseTableKeys(schemas))}
						>
							Select all
						</Button>
						<Button
							type='button'
							variant='ghost'
							size='sm'
							className='h-8 px-2 text-xs'
							onClick={() => onChange(new Set())}
						>
							Clear
						</Button>
					</div>
				</div>

				<div className='h-72 overflow-y-auto rounded-md border bg-transparent shadow-xs'>
					{filteredSchemas.length === 0 ? (
						<div className='flex h-full items-center justify-center px-4 text-sm text-muted-foreground'>
							{tableCount === 0 ? 'No tables were found.' : 'No tables match your search.'}
						</div>
					) : (
						filteredSchemas.map((schema) => (
							<SchemaSelection
								key={schema.schema}
								schema={schema}
								selectedTableKeys={selectedTableKeys}
								searching={search.trim().length > 0}
								onToggleSchema={toggleSchema}
								onToggleTable={toggleTable}
							/>
						))
					)}
				</div>
			</section>

			{error && <FormError error={error.message} />}

			<div className='flex items-center justify-between gap-2 border-t pt-4'>
				<Button type='button' variant='ghost' size='sm' onClick={onBack} disabled={isPending}>
					Previous
				</Button>
				<Button
					type='button'
					size='sm'
					onClick={onSubmit}
					disabled={selectedCount === 0 || isPending}
					isLoading={isPending}
				>
					Next
				</Button>
			</div>
		</div>
	);
}

function SchemaSelection({
	schema,
	selectedTableKeys,
	searching,
	onToggleSchema,
	onToggleTable,
}: {
	schema: WarehouseSchemaInventory;
	selectedTableKeys: Set<string>;
	searching: boolean;
	onToggleSchema: (schema: WarehouseSchemaInventory, checked: boolean) => void;
	onToggleTable: (schema: string, table: string, checked: boolean) => void;
}) {
	const [expanded, setExpanded] = useState(true);
	const panelId = useId();
	const selectedCount = schema.tables.filter((table) =>
		selectedTableKeys.has(getWarehouseTableKey(schema.schema, table)),
	).length;
	const checked = selectedCount === schema.tables.length;
	const checkboxState = selectedCount > 0 && !checked ? 'indeterminate' : checked;
	const open = searching || expanded;

	return (
		<section className='border-b last:border-b-0'>
			<div
				className={cn(
					'sticky top-0 z-10 flex h-10 items-center gap-2 bg-background/90 px-3 backdrop-blur-sm',
					open && 'border-b',
				)}
			>
				<Checkbox
					checked={checkboxState}
					aria-label={`Select all tables in ${schema.schema}`}
					onCheckedChange={(nextChecked) => onToggleSchema(schema, nextChecked === true)}
				/>
				<Layers3 className='size-4 text-muted-foreground' />
				<button
					type='button'
					className='flex min-w-0 flex-1 cursor-pointer items-center gap-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
					aria-label={`${open ? 'Collapse' : 'Expand'} ${schema.schema} schema`}
					aria-expanded={open}
					aria-controls={panelId}
					onClick={() => setExpanded((current) => !current)}
				>
					<span className='min-w-0 truncate text-sm font-medium' title={schema.schema}>
						{schema.schema}
					</span>
					<ChevronRight
						className={cn(
							'size-3.5 shrink-0 text-muted-foreground transition-transform',
							open && 'rotate-90',
						)}
					/>
				</button>
				<span className='text-xs text-muted-foreground'>
					{selectedCount}/{schema.tables.length}
				</span>
			</div>
			{open && (
				<ul id={panelId} className='py-1'>
					{schema.tables.map((table) => {
						const selected = selectedTableKeys.has(getWarehouseTableKey(schema.schema, table));
						return (
							<li key={table}>
								<label className='flex h-8 cursor-pointer items-center gap-2 px-3 pl-9 text-sm hover:bg-muted/50'>
									<Checkbox
										checked={selected}
										aria-label={`Select ${schema.schema}.${table}`}
										onCheckedChange={(nextChecked) =>
											onToggleTable(schema.schema, table, nextChecked === true)
										}
									/>
									<Table2 className='size-3.5 text-muted-foreground' />
									<span className='min-w-0 truncate' title={table}>
										{table}
									</span>
								</label>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}

export function getWarehouseTableKey(schema: string, table: string): string {
	return `${schema}\0${table}`;
}

export function getAllWarehouseTableKeys(schemas: WarehouseSchemaInventory[]): Set<string> {
	return new Set(
		schemas.flatMap((schema) => schema.tables.map((table) => getWarehouseTableKey(schema.schema, table))),
	);
}

export function getSelectedWarehouseTables(
	schemas: WarehouseSchemaInventory[],
	selectedTableKeys: Set<string>,
): Array<{ schema: string; table: string }> {
	return schemas.flatMap((schema) =>
		schema.tables
			.filter((table) => selectedTableKeys.has(getWarehouseTableKey(schema.schema, table)))
			.map((table) => ({ schema: schema.schema, table })),
	);
}

function filterSchemas(schemas: WarehouseSchemaInventory[], search: string): WarehouseSchemaInventory[] {
	const nonEmptySchemas = schemas.filter((schema) => schema.tables.length > 0);
	const query = search.trim().toLocaleLowerCase();
	if (!query) {
		return nonEmptySchemas;
	}
	return nonEmptySchemas.flatMap((schema) => {
		if (schema.schema.toLocaleLowerCase().includes(query)) {
			return [schema];
		}
		const tables = schema.tables.filter((table) => table.toLocaleLowerCase().includes(query));
		return tables.length > 0 ? [{ ...schema, tables }] : [];
	});
}

function countTables(schemas: WarehouseSchemaInventory[]): number {
	return schemas.reduce((count, schema) => count + schema.tables.length, 0);
}
