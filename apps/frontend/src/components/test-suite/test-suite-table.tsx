import { FlaskConical, MoreHorizontal, Pencil, Play, Trash2 } from 'lucide-react';

import { RateDelta, TestRateCell, TestStatusBadge } from './test-rate-cell';
import { getRateDelta } from './test-suite-utils';
import type { GitRef, SuiteTest, TestStatus } from './test-suite-types';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const MAX_VISIBLE_TAGS = 2;

export function TestSuiteTable({
	tests,
	baselineRef,
	candidateRef,
	statusOf,
	isRunning,
	runsPerTest,
	selectedIds,
	onSelectionChange,
	activeTestId,
	onOpenTest,
	onRunTest,
	onEditTest,
	onDeleteTest,
}: {
	tests: SuiteTest[];
	baselineRef: GitRef;
	candidateRef: GitRef;
	statusOf: (test: SuiteTest) => TestStatus;
	isRunning: (testId: string, refId: string) => boolean;
	runsPerTest: number;
	selectedIds: string[];
	onSelectionChange: (ids: string[]) => void;
	activeTestId: string | null;
	onOpenTest: (testId: string) => void;
	onRunTest: (testId: string) => void;
	onEditTest: (testId: string) => void;
	onDeleteTest: (testId: string) => void;
}) {
	const isComparing = baselineRef.id !== candidateRef.id;
	const allSelected = tests.length > 0 && tests.every((test) => selectedIds.includes(test.id));
	const someSelected = !allSelected && tests.some((test) => selectedIds.includes(test.id));

	function toggleAll() {
		onSelectionChange(allSelected ? [] : tests.map((test) => test.id));
	}

	function toggleOne(testId: string) {
		onSelectionChange(
			selectedIds.includes(testId) ? selectedIds.filter((id) => id !== testId) : [...selectedIds, testId],
		);
	}

	if (tests.length === 0) {
		return <EmptyTable />;
	}

	return (
		<div className='overflow-hidden rounded-xl border bg-background/60 shadow-xs'>
			<Table>
				<TableHeader className='bg-muted/30'>
					<TableRow className='hover:bg-transparent'>
						<TableHead className='w-10 pl-4'>
							<Checkbox
								checked={allSelected ? true : someSelected ? 'indeterminate' : false}
								onCheckedChange={toggleAll}
								aria-label='Select all tests'
							/>
						</TableHead>
						<TableHead className='text-xs text-muted-foreground'>Test</TableHead>
						<TableHead className='text-xs text-muted-foreground'>Tags</TableHead>
						<TableHead className='text-xs text-muted-foreground'>Owner</TableHead>
						<TableHead className='text-xs text-muted-foreground'>Production</TableHead>
						{isComparing && (
							<>
								<TableHead className='max-w-40 text-xs text-muted-foreground'>
									<span className='block truncate font-mono'>{candidateRef.name}</span>
								</TableHead>
								<TableHead className='text-xs text-muted-foreground'>Δ</TableHead>
							</>
						)}
						<TableHead className='text-xs text-muted-foreground'>Status</TableHead>
						<TableHead className='w-20' />
					</TableRow>
				</TableHeader>
				<TableBody>
					{tests.map((test) => (
						<TestRow
							key={test.id}
							test={test}
							baselineRef={baselineRef}
							candidateRef={candidateRef}
							isComparing={isComparing}
							status={statusOf(test)}
							isRunning={isRunning}
							runsPerTest={runsPerTest}
							isSelected={selectedIds.includes(test.id)}
							isActive={activeTestId === test.id}
							onToggle={() => toggleOne(test.id)}
							onOpen={() => onOpenTest(test.id)}
							onRun={() => onRunTest(test.id)}
							onEdit={() => onEditTest(test.id)}
							onDelete={() => onDeleteTest(test.id)}
						/>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

function TestRow({
	test,
	baselineRef,
	candidateRef,
	isComparing,
	status,
	isRunning,
	runsPerTest,
	isSelected,
	isActive,
	onToggle,
	onOpen,
	onRun,
	onEdit,
	onDelete,
}: {
	test: SuiteTest;
	baselineRef: GitRef;
	candidateRef: GitRef;
	isComparing: boolean;
	status: TestStatus;
	isRunning: (testId: string, refId: string) => boolean;
	runsPerTest: number;
	isSelected: boolean;
	isActive: boolean;
	onToggle: () => void;
	onOpen: () => void;
	onRun: () => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const isNewOnCandidate = isComparing && test.addedOnRef === candidateRef.id;

	return (
		<TableRow
			data-state={isSelected ? 'selected' : undefined}
			className={cn('group cursor-pointer', isActive && 'bg-muted/60')}
			onClick={onOpen}
		>
			<TableCell className='pl-4' onClick={(event) => event.stopPropagation()}>
				<Checkbox checked={isSelected} onCheckedChange={onToggle} aria-label={`Select ${test.name}`} />
			</TableCell>
			<TableCell className='max-w-80'>
				<div className='flex items-center gap-2'>
					<span className='truncate font-mono text-[13px] font-medium'>{test.name}</span>
					{isNewOnCandidate && (
						<span className='shrink-0 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400'>
							New on branch
						</span>
					)}
				</div>
				<p className='truncate text-xs text-muted-foreground'>{test.prompt}</p>
			</TableCell>
			<TableCell>
				<TagList tags={test.tags} />
			</TableCell>
			<TableCell>
				<div className='flex items-center gap-2'>
					<Avatar username={test.owner} size='sm' className='size-5 text-[9px]' />
					<span className='text-sm'>{test.owner.split(' ')[0]}</span>
				</div>
			</TableCell>
			<TableCell>
				<TestRateCell
					result={test.results[baselineRef.id]}
					isRunning={isRunning(test.id, baselineRef.id)}
					runsPerTest={runsPerTest}
				/>
			</TableCell>
			{isComparing && (
				<>
					<TableCell>
						<TestRateCell
							result={test.results[candidateRef.id]}
							isRunning={isRunning(test.id, candidateRef.id)}
							runsPerTest={runsPerTest}
						/>
					</TableCell>
					<TableCell>
						<RateDelta delta={getRateDelta(test, baselineRef.id, candidateRef.id)} />
					</TableCell>
				</>
			)}
			<TableCell>
				<TestStatusBadge status={status} />
			</TableCell>
			<TableCell className='pr-3 text-right' onClick={(event) => event.stopPropagation()}>
				<div className='flex items-center justify-end gap-0.5'>
					<SimpleTooltip content={`Run ${runsPerTest}×`}>
						<Button
							variant='ghost-muted'
							size='icon-xs'
							className='opacity-0 group-hover:opacity-100'
							onClick={onRun}
							aria-label={`Run ${test.name}`}
						>
							<Play />
						</Button>
					</SimpleTooltip>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant='ghost-muted' size='icon-xs' aria-label='Test actions'>
								<MoreHorizontal />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end'>
							<DropdownMenuItem onSelect={onRun}>
								<Play />
								Run {runsPerTest}×
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={onEdit}>
								<Pencil />
								Edit test
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem variant='destructive' onSelect={onDelete}>
								<Trash2 />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</TableCell>
		</TableRow>
	);
}

function TagList({ tags }: { tags: string[] }) {
	const visible = tags.slice(0, MAX_VISIBLE_TAGS);
	const hidden = tags.slice(MAX_VISIBLE_TAGS);
	return (
		<div className='flex items-center gap-1'>
			{visible.map((tag) => (
				<span key={tag} className='rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground/80'>
					{tag}
				</span>
			))}
			{hidden.length > 0 && (
				<SimpleTooltip content={hidden.join(', ')}>
					<span className='text-xs text-muted-foreground'>+{hidden.length}</span>
				</SimpleTooltip>
			)}
		</div>
	);
}

function EmptyTable() {
	return (
		<div className='flex flex-col items-center justify-center rounded-xl border border-dashed bg-background/40 p-10 text-center'>
			<FlaskConical className='mb-3 size-8 text-muted-foreground' />
			<h2 className='font-medium'>No matching tests</h2>
			<p className='mt-1 text-sm text-muted-foreground'>
				Nothing matches your current filters. Try clearing or adjusting them.
			</p>
		</div>
	);
}
