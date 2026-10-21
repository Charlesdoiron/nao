// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RequestWarehouseCredentialsToolCall } from './request-warehouse-credentials';
import type { ToolCallComponentProps } from '.';

const mocks = vi.hoisted(() => ({
	isRunning: true,
	jobStatus: 'awaiting_context',
	activeJobId: 'job-1' as string | undefined,
	activeJobIsFetched: true,
	messages: [] as never[],
	queueOrSendMessage: vi.fn().mockResolvedValue(undefined),
	validateCredentials: vi.fn().mockResolvedValue({
		valid: true,
		schemas: [{ schema: 'public', tables: ['customers', 'orders'] }],
	}),
	validateNotion: vi.fn().mockResolvedValue({
		valid: true,
		pages: [{ url: 'https://notion.so/page', title: 'Company context' }],
	}),
	validateConfluence: vi.fn().mockResolvedValue({
		valid: true,
		pages: [{ url: 'https://acme.atlassian.net/wiki/pages/123', title: 'Company context' }],
	}),
	startProvisioning: vi.fn().mockResolvedValue({ jobId: 'new-job', status: 'queued' }),
}));

vi.mock('@tanstack/react-query', () => ({
	useMutation: (options: { mutationKey?: string[] }) => ({
		error: null,
		isPending: false,
		mutateAsync:
			options.mutationKey?.[0] === 'validate-credentials'
				? mocks.validateCredentials
				: options.mutationKey?.[0] === 'validate-notion'
					? mocks.validateNotion
					: options.mutationKey?.[0] === 'validate-confluence'
						? mocks.validateConfluence
						: mocks.startProvisioning,
		reset: vi.fn(),
	}),
	useQuery: (options: { queryKey: string[] }) =>
		options.queryKey[0] === 'active-job'
			? {
					data: mocks.activeJobId ? { id: mocks.activeJobId, provider: 'postgres' } : undefined,
					isFetched: mocks.activeJobIsFetched,
				}
			: { data: { provider: 'postgres', status: mocks.jobStatus }, isError: false },
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/contexts/agent.provider', () => ({
	useAgentContext: () => ({
		chatId: 'chat-1',
		isRunning: mocks.isRunning,
		queueOrSendMessage: mocks.queueOrSendMessage,
	}),
	useAgentMessagesSelector: (selector: (messages: never[]) => unknown) => selector(mocks.messages),
}));

vi.mock('@/main', () => ({
	trpc: {
		onboarding: {
			validateWarehouseCredentials: {
				mutationOptions: () => ({ mutationKey: ['validate-credentials'] }),
			},
			validateNotionContext: {
				mutationOptions: () => ({ mutationKey: ['validate-notion'] }),
			},
			validateConfluenceContext: {
				mutationOptions: () => ({ mutationKey: ['validate-confluence'] }),
			},
			getActiveWarehouseProvisioningJob: {
				queryOptions: () => ({ queryKey: ['active-job'] }),
			},
			getWarehouseProvisioningStatus: {
				queryOptions: () => ({ queryKey: ['job'] }),
			},
			startWarehouseProvisioning: {
				mutationOptions: () => ({ mutationKey: ['start-provisioning'] }),
			},
		},
	},
}));

vi.mock('./warehouse-credentials-form', () => ({
	WarehouseCredentialsForm: ({
		onCancel,
		onSubmit,
		onValidate,
		onValuesChange,
		onValidatedFingerprintChange,
	}: {
		onCancel: () => void;
		onSubmit: (values: Record<string, never>) => Promise<void>;
		onValidate: (values: Record<string, never>) => Promise<void>;
		onValuesChange: (values: Record<string, never>) => void;
		onValidatedFingerprintChange: (fingerprint: string) => void;
	}) => (
		<>
			<button
				type='button'
				onClick={() => {
					onValuesChange({});
					onValidatedFingerprintChange(JSON.stringify({}));
					onCancel();
				}}
			>
				Verify credentials
			</button>
			<button
				type='button'
				onClick={() => {
					onValuesChange({});
					void onValidate({}).then(() => onValidatedFingerprintChange(JSON.stringify({})));
				}}
			>
				Discover tables
			</button>
			<button type='button' onClick={() => void onSubmit({})}>
				Next
			</button>
		</>
	),
}));

afterEach(() => {
	cleanup();
	mocks.isRunning = true;
	mocks.jobStatus = 'awaiting_context';
	mocks.activeJobId = 'job-1';
	mocks.activeJobIsFetched = true;
	mocks.messages = [];
	vi.clearAllMocks();
});

describe('RequestWarehouseCredentialsToolCall', () => {
	it('shows a verified state that lets users edit their credentials', async () => {
		mocks.activeJobId = undefined;
		const toolPart = {
			type: 'tool-request_warehouse_credentials',
			toolCallId: 'tool-1',
			state: 'output-available',
			input: { provider: 'postgres' },
			output: { provider: 'postgres', status: 'credentials-required' },
		} as ToolCallComponentProps<'request_warehouse_credentials'>['toolPart'];
		render(<RequestWarehouseCredentialsToolCall toolPart={toolPart} />);

		fireEvent.click(screen.getByRole('button', { name: 'Enter credentials' }));
		fireEvent.click(screen.getByRole('button', { name: 'Verify credentials' }));

		await screen.findByText('Postgres credentials verified');
		expect(screen.getByRole('button', { name: 'Edit credentials' })).toBeTruthy();
	});

	it('shows verified credentials while setup is in progress', async () => {
		mocks.jobStatus = 'initializing';
		const toolPart = {
			type: 'tool-request_warehouse_credentials',
			toolCallId: 'tool-1',
			state: 'output-available',
			input: { provider: 'postgres' },
			output: { provider: 'postgres', status: 'credentials-required' },
		} as ToolCallComponentProps<'request_warehouse_credentials'>['toolPart'];
		render(<RequestWarehouseCredentialsToolCall toolPart={toolPart} />);

		await screen.findByText('Postgres credentials verified');
		expect(screen.getByText('Your connection is being set up.')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'View progress' })).toBeTruthy();
	});

	it('discovers tables before starting provisioning with the selected tables', async () => {
		mocks.activeJobId = undefined;
		const toolPart = {
			type: 'tool-request_warehouse_credentials',
			toolCallId: 'tool-1',
			state: 'output-available',
			input: { provider: 'postgres' },
			output: { provider: 'postgres', status: 'credentials-required' },
		} as ToolCallComponentProps<'request_warehouse_credentials'>['toolPart'];
		render(<RequestWarehouseCredentialsToolCall toolPart={toolPart} />);

		fireEvent.click(screen.getByRole('button', { name: 'Enter credentials' }));
		expect((screen.getByRole('button', { name: /Tables/ }) as HTMLButtonElement).disabled).toBe(true);
		expect((screen.getByRole('button', { name: /Business context/ }) as HTMLButtonElement).disabled).toBe(true);
		expect(document.querySelector('[data-slot="dialog-overlay"]')?.className).toContain(
			'data-[state=open]:animate-none',
		);
		fireEvent.click(screen.getByRole('button', { name: 'Discover tables' }));
		await waitFor(() => expect(mocks.validateCredentials).toHaveBeenCalledOnce());
		expect(screen.getByText('Postgres credentials verified')).toBeTruthy();
		expect(screen.queryByText('Tables to sync')).toBeNull();
		expect((screen.getByRole('button', { name: /Tables/ }) as HTMLButtonElement).disabled).toBe(false);
		expect((screen.getByRole('button', { name: /Business context/ }) as HTMLButtonElement).disabled).toBe(false);

		fireEvent.click(screen.getByRole('button', { name: /Business context/ }));
		await screen.findByText('Notion');
		fireEvent.click(screen.getByRole('button', { name: /Credentials/ }));

		fireEvent.click(screen.getByRole('button', { name: 'Next' }));
		await screen.findByText('Tables to sync');

		fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
		expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Next' }));

		fireEvent.click(screen.getByRole('checkbox', { name: 'Select public.orders' }));
		fireEvent.click(screen.getByRole('button', { name: 'Next' }));
		await screen.findByText('Notion');
		const confluenceCard = screen.getByRole('heading', { name: 'Confluence' }).closest('section');
		expect(confluenceCard).toBeTruthy();
		fireEvent.click(within(confluenceCard!).getByRole('button', { name: 'Connect' }));
		fireEvent.change(screen.getByLabelText('Confluence site URL'), {
			target: { value: 'https://acme.atlassian.net/wiki' },
		});
		fireEvent.change(screen.getByLabelText('Account email'), {
			target: { value: 'person@acme.com' },
		});
		fireEvent.change(screen.getByLabelText('API token'), {
			target: { value: 'atlassian-secret' },
		});
		fireEvent.change(screen.getByLabelText('Page URLs or IDs'), { target: { value: '123' } });
		fireEvent.click(screen.getByRole('button', { name: 'Connect Confluence' }));
		await waitFor(() => expect(mocks.validateConfluence).toHaveBeenCalledOnce());
		await screen.findByText('Confluence connected · 1 page');
		fireEvent.click(screen.getByRole('button', { name: 'Sync with context' }));

		await waitFor(() =>
			expect(mocks.startProvisioning).toHaveBeenCalledWith({
				provider: 'postgres',
				credentials: expect.any(Object),
				contextSources: {
					confluence: {
						baseUrl: 'https://acme.atlassian.net/wiki',
						email: 'person@acme.com',
						apiToken: 'atlassian-secret',
						pages: ['123'],
					},
				},
				tableSelection: {
					mode: 'selected',
					tables: [{ schema: 'public', table: 'customers' }],
				},
				onboardingChatId: 'chat-1',
			}),
		);
	});

	it('waits for the current turn to finish before requesting business context', async () => {
		const toolPart = {
			type: 'tool-request_warehouse_credentials',
			toolCallId: 'tool-1',
			state: 'output-available',
			input: { provider: 'postgres' },
			output: { provider: 'postgres', status: 'credentials-required' },
		} as ToolCallComponentProps<'request_warehouse_credentials'>['toolPart'];
		const view = render(<RequestWarehouseCredentialsToolCall toolPart={toolPart} />);

		await waitFor(() => expect(mocks.queueOrSendMessage).not.toHaveBeenCalled());

		mocks.isRunning = false;
		view.rerender(<RequestWarehouseCredentialsToolCall toolPart={toolPart} />);

		await waitFor(() =>
			expect(mocks.queueOrSendMessage).toHaveBeenCalledWith({
				text: '[internal:onboarding-context-request] jobId=job-1',
			}),
		);
	});

	it('hides the credentials request after provisioning completes', async () => {
		mocks.jobStatus = 'ready';
		const toolPart = {
			type: 'tool-request_warehouse_credentials',
			toolCallId: 'tool-1',
			state: 'output-available',
			input: { provider: 'postgres' },
			output: { provider: 'postgres', status: 'credentials-required' },
		} as ToolCallComponentProps<'request_warehouse_credentials'>['toolPart'];
		const view = render(<RequestWarehouseCredentialsToolCall toolPart={toolPart} />);

		await waitFor(() => expect(view.queryByText('Action required')).toBeNull());
	});

	it('waits for the active job before falling back to a persisted job ID', async () => {
		mocks.isRunning = false;
		mocks.activeJobId = undefined;
		mocks.activeJobIsFetched = false;
		mocks.messages = [
			{
				role: 'assistant',
				parts: [
					{
						type: 'tool-generate_onboarding_rules',
						state: 'output-available',
						output: { jobId: 'old-job' },
					},
				],
			},
		] as never[];
		const toolPart = {
			type: 'tool-request_warehouse_credentials',
			toolCallId: 'tool-1',
			state: 'output-available',
			input: { provider: 'postgres' },
			output: { provider: 'postgres', status: 'credentials-required' },
		} as ToolCallComponentProps<'request_warehouse_credentials'>['toolPart'];
		const view = render(<RequestWarehouseCredentialsToolCall toolPart={toolPart} />);

		await waitFor(() => expect(mocks.queueOrSendMessage).not.toHaveBeenCalled());

		mocks.activeJobId = 'new-job';
		mocks.activeJobIsFetched = true;
		view.rerender(<RequestWarehouseCredentialsToolCall toolPart={toolPart} />);

		await waitFor(() =>
			expect(mocks.queueOrSendMessage).toHaveBeenCalledWith({
				text: '[internal:onboarding-context-request] jobId=new-job',
			}),
		);
	});
});
