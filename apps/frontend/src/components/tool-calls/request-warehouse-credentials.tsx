import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { buildWarehouseCredentials } from './warehouse-credentials';
import { WarehouseCredentialsForm } from './warehouse-credentials-form';
import { isSqlProvider, WAREHOUSE_PROVIDER_LABELS } from './warehouse-provider-config';
import {
	ConfluenceContextSetup,
	getConfluenceContextFingerprint,
	parseConfluencePages,
} from './confluence-context-setup';
import { GithubContextSetup } from './github-context-setup';
import { getNotionContextFingerprint, NotionContextSetup, parseNotionPages } from './notion-context-setup';
import {
	getAllWarehouseTableKeys,
	getSelectedWarehouseTables,
	WarehouseTableSelection,
} from './warehouse-table-selection';
import type { WarehouseCredentialsFormValues } from './warehouse-credentials';
import type { WarehouseSchemaInventory } from './warehouse-table-selection';
import type { ConfluenceContextValues } from './confluence-context-setup';
import type { GithubContextValues } from './github-context-setup';
import type { NotionContextValues } from './notion-context-setup';
import type { ToolCallComponentProps } from '.';

import { Button } from '@/components/ui/button';
import { DatabaseIcon } from '@/components/ui/database-icon';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form-fields';
import { findWarehouseJobId } from '@/components/onboarding-progress';
import { useAgentContext, useAgentMessagesSelector } from '@/contexts/agent.provider';
import { getMessageText, NEW_CHAT_ID, ONBOARDING_CONTEXT_REQUEST_PREFIX } from '@/lib/ai';
import { cn } from '@/lib/utils';
import { trpc } from '@/main';

export { WarehouseCredentialsForm as SqlCredentialsForm } from './warehouse-credentials-form';

type SetupStep = 'credentials' | 'tables' | 'context';
type SelectedContextSources = {
	notion?: { apiKey: string; pages: string[] };
	confluence?: { baseUrl: string; email: string; apiToken: string; pages: string[] };
	github?: GithubContextValues;
};

export function RequestWarehouseCredentialsToolCall({
	toolPart,
}: ToolCallComponentProps<'request_warehouse_credentials'>) {
	const provider = toolPart.input?.provider;
	const [open, setOpen] = useState(false);
	const [jobId, setJobId] = useState<string | null>(null);
	const [dialogCenter, setDialogCenter] = useState<number>();
	const [credentialValues, setCredentialValues] = useState<WarehouseCredentialsFormValues>();
	const [validatedCredentialFingerprint, setValidatedCredentialFingerprint] = useState<string | null>(null);
	const [setupStep, setSetupStep] = useState<SetupStep>('credentials');
	const [discoveredSchemas, setDiscoveredSchemas] = useState<WarehouseSchemaInventory[]>();
	const [selectedTableKeys, setSelectedTableKeys] = useState<Set<string>>(new Set());
	const [notionValues, setNotionValues] = useState<NotionContextValues>({ apiKey: '', pagesText: '' });
	const [validatedNotionFingerprint, setValidatedNotionFingerprint] = useState<string | null>(null);
	const [validatedNotionPages, setValidatedNotionPages] = useState<Array<{ url: string; title: string }>>([]);
	const [confluenceValues, setConfluenceValues] = useState<ConfluenceContextValues>({
		baseUrl: '',
		email: '',
		apiToken: '',
		pagesText: '',
	});
	const [validatedConfluenceFingerprint, setValidatedConfluenceFingerprint] = useState<string | null>(null);
	const [validatedConfluencePages, setValidatedConfluencePages] = useState<Array<{ url: string; title: string }>>([]);
	const [githubValues, setGithubValues] = useState<GithubContextValues>({ repoFullName: '', branch: '' });
	const cardRef = useRef<HTMLDivElement>(null);
	const notifiedJobId = useRef<string | null>(null);
	const restoredJobId = useRef(false);
	const { chatId, isRunning, queueOrSendMessage } = useAgentContext();
	const queryClient = useQueryClient();
	const canRestoreJob = Boolean(chatId && chatId !== NEW_CHAT_ID);
	const alignDialog = useCallback(() => {
		const cardBounds = cardRef.current?.getBoundingClientRect();
		setDialogCenter(cardBounds ? cardBounds.left + cardBounds.width / 2 : undefined);
	}, []);
	const activeJob = useQuery({
		...trpc.onboarding.getActiveWarehouseProvisioningJob.queryOptions({
			onboardingChatId: canRestoreJob ? chatId! : '',
		}),
		enabled: canRestoreJob,
	});
	const persistedJobId = useAgentMessagesSelector(findWarehouseJobId);
	const job = useWarehouseProvisioningJob(jobId);
	const hasRequestedContext = useAgentMessagesSelector((messages) =>
		jobId
			? messages.some(
					(message) =>
						message.role === 'user' &&
						getMessageText(message).startsWith(`${ONBOARDING_CONTEXT_REQUEST_PREFIX} jobId=${jobId}`),
				)
			: false,
	);
	const validateCredentials = useMutation(trpc.onboarding.validateWarehouseCredentials.mutationOptions());
	const validateNotion = useMutation(trpc.onboarding.validateNotionContext.mutationOptions());
	const validateConfluence = useMutation(trpc.onboarding.validateConfluenceContext.mutationOptions());
	const startProvisioning = useMutation(
		trpc.onboarding.startWarehouseProvisioning.mutationOptions({
			onSuccess: ({ jobId: nextJobId }) => {
				setJobId(nextJobId);
				if (canRestoreJob) {
					void queryClient.invalidateQueries({
						queryKey: trpc.onboarding.getActiveWarehouseProvisioningJob.queryKey({
							onboardingChatId: chatId!,
						}),
					});
				}
			},
		}),
	);

	useEffect(() => {
		if (canRestoreJob && !activeJob.isFetched) {
			return;
		}
		const restoredId = activeJob.data && activeJob.data.provider === provider ? activeJob.data.id : persistedJobId;
		if (restoredJobId.current || !restoredId) {
			return;
		}
		restoredJobId.current = true;
		setJobId(restoredId);
	}, [activeJob.data, activeJob.isFetched, canRestoreJob, persistedJobId, provider]);

	useEffect(() => {
		if (job.data && job.data.provider !== provider) {
			setJobId(null);
		}
	}, [job.data, provider]);

	useEffect(() => {
		const status = job.data?.status;
		if (
			!jobId ||
			job.data?.provider !== provider ||
			isRunning ||
			hasRequestedContext ||
			(status !== 'syncing' && status !== 'registering' && status !== 'awaiting_context') ||
			notifiedJobId.current === jobId
		) {
			return;
		}

		notifiedJobId.current = jobId;
		setOpen(false);
		void queueOrSendMessage({
			text: `${ONBOARDING_CONTEXT_REQUEST_PREFIX} jobId=${jobId}`,
		}).catch((error) => {
			if (notifiedJobId.current === jobId) {
				notifiedJobId.current = null;
			}
			console.error(error);
		});
	}, [hasRequestedContext, isRunning, job.data?.provider, job.data?.status, jobId, provider, queueOrSendMessage]);

	useEffect(() => {
		if (!open) {
			return;
		}

		alignDialog();
		window.addEventListener('resize', alignDialog);
		return () => window.removeEventListener('resize', alignDialog);
	}, [alignDialog, open]);

	if (!provider || job.data?.status === 'ready') {
		return null;
	}

	const setupFailed = job.data?.status === 'failed' || job.data?.status === 'cancelled';
	const setupInProgress = startProvisioning.isPending || (jobId !== null && !setupFailed);
	const credentialsVerified =
		validatedCredentialFingerprint !== null &&
		credentialValues !== undefined &&
		validatedCredentialFingerprint === JSON.stringify(credentialValues);
	const setupStepsUnlocked = credentialsVerified && discoveredSchemas !== undefined;
	const tableSelectionReady = setupStep === 'tables' && discoveredSchemas !== undefined && !setupInProgress;
	const contextSetupReady = setupStep === 'context' && discoveredSchemas !== undefined && !setupInProgress;
	const credentialsAccepted = credentialsVerified || setupInProgress;
	const notionConnected =
		validatedNotionFingerprint !== null && validatedNotionFingerprint === getNotionContextFingerprint(notionValues);
	const confluenceConnected =
		validatedConfluenceFingerprint !== null &&
		validatedConfluenceFingerprint === getConfluenceContextFingerprint(confluenceValues);
	const githubConnected = githubValues.repoFullName.length > 0 && githubValues.branch.length > 0;
	const selectedContextSources: SelectedContextSources = {
		...(notionConnected && {
			notion: { apiKey: notionValues.apiKey, pages: parseNotionPages(notionValues.pagesText) },
		}),
		...(confluenceConnected && {
			confluence: {
				baseUrl: confluenceValues.baseUrl.trim(),
				email: confluenceValues.email.trim(),
				apiToken: confluenceValues.apiToken.trim(),
				pages: parseConfluencePages(confluenceValues.pagesText),
			},
		}),
		...(githubConnected && { github: githubValues }),
	};
	const hasConnectedContext = notionConnected || confluenceConnected || githubConnected;
	const startSelectedProvisioning = async (contextSources: SelectedContextSources = {}) => {
		if (!credentialValues || !discoveredSchemas) {
			return;
		}
		const selectedTables = getSelectedWarehouseTables(discoveredSchemas, selectedTableKeys);
		const tableCount = discoveredSchemas.reduce((count, schema) => count + schema.tables.length, 0);
		await startProvisioning.mutateAsync({
			provider,
			credentials: buildWarehouseCredentials(provider, credentialValues),
			contextSources,
			tableSelection:
				selectedTables.length === tableCount ? { mode: 'all' } : { mode: 'selected', tables: selectedTables },
			...(canRestoreJob && { onboardingChatId: chatId }),
		});
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<div
				ref={cardRef}
				className={cn(
					'animate-fade-in-up flex flex-col items-start justify-between gap-4 rounded-xl border bg-background p-5 shadow-xs sm:flex-row sm:items-center',
					setupFailed
						? 'border-destructive/20'
						: credentialsAccepted
							? 'border-emerald-500/25'
							: 'border-violet/20',
				)}
			>
				<div className='flex min-w-0 items-center gap-3'>
					<div
						className={cn(
							'flex size-10 shrink-0 items-center justify-center rounded-lg border',
							setupFailed
								? 'border-destructive/20 bg-destructive/5 text-destructive'
								: credentialsAccepted
									? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
									: 'border-violet/20 bg-violet/10 text-primary',
						)}
					>
						<DatabaseIcon dialect={provider} className='size-5' />
					</div>
					<div className='min-w-0'>
						<div className='font-borna text-lg font-medium tracking-tight text-foreground'>
							{setupFailed
								? `${WAREHOUSE_PROVIDER_LABELS[provider]} setup needs attention`
								: contextSetupReady
									? 'Business context optional'
									: tableSelectionReady
										? `${WAREHOUSE_PROVIDER_LABELS[provider]} tables ready`
										: credentialsAccepted
											? `${WAREHOUSE_PROVIDER_LABELS[provider]} credentials verified`
											: `${WAREHOUSE_PROVIDER_LABELS[provider]} credentials required`}
						</div>
						<p className='text-xs text-muted-foreground'>
							{setupFailed
								? 'Open the setup to review the problem and try again.'
								: setupInProgress
									? 'Your connection is being set up.'
									: contextSetupReady
										? 'Connect documentation or skip to start syncing.'
										: tableSelectionReady
											? 'Review which tables nao should sync.'
											: credentialsVerified
												? 'Ready to continue. You can still review or edit these details.'
												: 'Credentials are submitted securely and are never shared with the agent.'}
						</p>
					</div>
				</div>
				<DialogTrigger asChild>
					<Button
						variant={credentialsAccepted || setupFailed ? 'outline' : 'default'}
						className={cn(
							'w-full shrink-0 rounded-full sm:w-auto',
							setupFailed &&
								'border-destructive/25 text-destructive hover:bg-destructive/5 hover:text-destructive',
							credentialsAccepted &&
								'border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-400',
						)}
					>
						{setupFailed
							? 'Review setup'
							: setupInProgress
								? 'View progress'
								: contextSetupReady
									? 'Add context'
									: tableSelectionReady
										? 'Choose tables'
										: credentialsVerified
											? 'Edit credentials'
											: 'Enter credentials'}
					</Button>
				</DialogTrigger>
			</div>
			<DialogContent
				className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'
				overlayClassName='data-[state=open]:animate-none data-[state=closed]:animate-none'
				style={dialogCenter === undefined ? undefined : { left: dialogCenter }}
			>
				<DialogHeader className='pr-8'>
					<div className='flex items-start gap-3 text-left'>
						<div className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet/15 text-violet'>
							<DatabaseIcon dialect={provider} className='size-5' />
						</div>
						<div className='space-y-1'>
							<DialogTitle>
								{jobId
									? `Set up ${WAREHOUSE_PROVIDER_LABELS[provider]}`
									: setupStep === 'context'
										? 'Add business context'
										: setupStep === 'tables'
											? `Choose ${WAREHOUSE_PROVIDER_LABELS[provider]} data`
											: `Connect ${WAREHOUSE_PROVIDER_LABELS[provider]}`}
							</DialogTitle>
							<DialogDescription>
								{jobId
									? 'Preparing your nao project and syncing metadata.'
									: setupStep === 'context'
										? 'Optionally connect documentation before starting sync.'
										: setupStep === 'tables'
											? 'Choose the tables nao should use as context.'
											: 'Add a secure connection for your nao project.'}
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>
				{!jobId && isSqlProvider(provider) && (
					<SetupStepNavigation
						activeStep={setupStep}
						unlocked={setupStepsUnlocked}
						selectedTableCount={selectedTableKeys.size}
						onStepChange={setSetupStep}
					/>
				)}
				{jobId ? (
					<WarehouseProvisioningProgress
						job={job}
						onRetry={() => {
							setJobId(null);
							startProvisioning.reset();
						}}
					/>
				) : setupStep === 'context' ? (
					<NotionContextSetup
						values={notionValues}
						validatedFingerprint={validatedNotionFingerprint}
						validatedPages={validatedNotionPages}
						isValidating={validateNotion.isPending}
						isContextValidating={validateNotion.isPending || validateConfluence.isPending}
						isStarting={startProvisioning.isPending}
						canStart={selectedTableKeys.size > 0}
						hasConnectedContext={hasConnectedContext}
						additionalProviders={
							<>
								<ConfluenceContextSetup
									values={confluenceValues}
									validatedFingerprint={validatedConfluenceFingerprint}
									validatedPages={validatedConfluencePages}
									isValidating={validateConfluence.isPending}
									isStarting={startProvisioning.isPending}
									error={validateConfluence.error}
									onValuesChange={setConfluenceValues}
									onValidatedFingerprintChange={setValidatedConfluenceFingerprint}
									onValidate={async (values) => {
										const result = await validateConfluence.mutateAsync({
											baseUrl: values.baseUrl.trim(),
											email: values.email.trim(),
											apiToken: values.apiToken.trim(),
											pages: parseConfluencePages(values.pagesText),
										});
										setValidatedConfluencePages(result.pages);
									}}
								/>
								<GithubContextSetup
									values={githubValues}
									isStarting={startProvisioning.isPending}
									onValuesChange={setGithubValues}
								/>
							</>
						}
						error={validateNotion.error ?? startProvisioning.error}
						onValuesChange={setNotionValues}
						onValidatedFingerprintChange={setValidatedNotionFingerprint}
						onValidate={async (values) => {
							const result = await validateNotion.mutateAsync({
								apiKey: values.apiKey,
								pages: parseNotionPages(values.pagesText),
							});
							setValidatedNotionPages(result.pages);
						}}
						onBack={() => setSetupStep('tables')}
						onSkip={() => void startSelectedProvisioning()}
						onSubmit={() => void startSelectedProvisioning(selectedContextSources)}
					/>
				) : setupStep === 'tables' && discoveredSchemas ? (
					<WarehouseTableSelection
						schemas={discoveredSchemas}
						selectedTableKeys={selectedTableKeys}
						isPending={startProvisioning.isPending}
						error={startProvisioning.error}
						onChange={setSelectedTableKeys}
						onBack={() => setSetupStep('credentials')}
						onSubmit={() => setSetupStep('context')}
					/>
				) : isSqlProvider(provider) ? (
					<WarehouseCredentialsForm
						provider={provider}
						onValidate={async (values) => {
							const result = await validateCredentials.mutateAsync({
								provider,
								credentials: buildWarehouseCredentials(provider, values),
							});
							setDiscoveredSchemas(result.schemas);
							setSelectedTableKeys(getAllWarehouseTableKeys(result.schemas));
						}}
						onSubmit={async () => {
							if (discoveredSchemas) {
								setSetupStep('tables');
							}
						}}
						onCancel={() => setOpen(false)}
						isValidating={validateCredentials.isPending}
						isPending={startProvisioning.isPending}
						error={validateCredentials.error ?? startProvisioning.error}
						initialValues={credentialValues}
						onValuesChange={setCredentialValues}
						initialValidatedFingerprint={validatedCredentialFingerprint}
						onValidatedFingerprintChange={setValidatedCredentialFingerprint}
					/>
				) : (
					<div className='rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground'>
						{WAREHOUSE_PROVIDER_LABELS[provider]} connection setup is not available yet.
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

function SetupStepNavigation({
	activeStep,
	unlocked,
	selectedTableCount,
	onStepChange,
}: {
	activeStep: SetupStep;
	unlocked: boolean;
	selectedTableCount: number;
	onStepChange: (step: SetupStep) => void;
}) {
	const steps: Array<{ id: SetupStep; label: string }> = [
		{ id: 'credentials', label: 'Credentials' },
		{ id: 'tables', label: 'Tables' },
		{ id: 'context', label: 'Business context' },
	];

	return (
		<nav aria-label='Setup steps' className='relative -mx-6 px-6 pt-1'>
			<div className='pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border' />
			<div className='flex min-h-10 items-end gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
				{steps.map((step) => {
					const disabled = step.id !== 'credentials' && !unlocked;
					const active = step.id === activeStep;

					return (
						<button
							key={step.id}
							type='button'
							aria-current={active ? 'step' : undefined}
							disabled={disabled}
							title={disabled ? 'Validate credentials to unlock' : undefined}
							onClick={() => onStepChange(step.id)}
							className={cn(
								'relative z-10 flex h-9 shrink-0 items-center gap-1.5 rounded-t-md border px-3 text-sm font-medium transition-colors',
								active
									? 'border-border border-b-0 bg-background text-foreground'
									: 'border-transparent text-muted-foreground hover:bg-background/50 hover:text-foreground',
								disabled &&
									'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-muted-foreground',
							)}
						>
							{step.label}
							{step.id === 'tables' && unlocked && (
								<span className='text-xs font-normal text-muted-foreground'>{selectedTableCount}</span>
							)}
						</button>
					);
				})}
			</div>
		</nav>
	);
}

export function useWarehouseProvisioningJob(jobId: string | null) {
	return useQuery({
		...trpc.onboarding.getWarehouseProvisioningStatus.queryOptions({ jobId: jobId ?? '' }),
		enabled: jobId !== null,
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			return status === 'ready' || status === 'failed' || status === 'cancelled' ? false : 1000;
		},
	});
}

function WarehouseProvisioningProgress({
	job,
	onRetry,
}: {
	job: ReturnType<typeof useWarehouseProvisioningJob>;
	onRetry: () => void;
}) {
	if (job.isError) {
		return <FormError error={job.error.message} />;
	}

	if (job.data?.status === 'failed' || job.data?.status === 'cancelled') {
		return (
			<div className='flex flex-col gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4'>
				<FormError error={job.data.error ?? 'Warehouse setup failed.'} />
				<Button variant='outline' size='sm' onClick={onRetry}>
					Try again
				</Button>
			</div>
		);
	}

	const statusLabel = {
		queued: 'Preparing warehouse setup…',
		initializing: 'Initializing your nao project…',
		debugging: 'Checking your warehouse connection…',
		syncing: 'Syncing warehouse metadata…',
		awaiting_context: 'Collecting business context…',
		finalizing: 'Finalizing your connection…',
		registering: 'Registering your project…',
		publishing: 'Publishing your project…',
		failed: 'Warehouse setup failed. Please try again.',
		cancelled: 'Warehouse setup was cancelled.',
		ready: 'Connection ready.',
	}[job.data?.status ?? 'queued'];

	return (
		<div className='flex items-center gap-3 rounded-lg border bg-muted/30 p-4'>
			<Loader2 className='size-4 animate-spin text-primary' />
			<p className='text-sm'>{statusLabel}</p>
		</div>
	);
}
