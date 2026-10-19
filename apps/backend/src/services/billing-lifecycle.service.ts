import * as billingQueries from '../queries/billing.queries';
import { logger, serializeError } from '../utils/logger';
import { reconcileCloudBillingCustomer } from './billing-reconciliation.service';
import { provisionCloudTrial } from './cloud-trial-provisioning.service';

const BILLING_LIFECYCLE_CONCURRENCY = 5;

export async function runCloudBillingLifecycle(): Promise<void> {
	const pendingTrials = await billingQueries.listOrganizationTrialsPendingStripeProvisioning(new Date());
	await provisionPendingTrials(pendingTrials);
	await reconcileMappedOrganizations(new Set(pendingTrials.map((billing) => billing.orgId)));
}

async function provisionPendingTrials(
	billings: Awaited<ReturnType<typeof billingQueries.listOrganizationTrialsPendingStripeProvisioning>>,
): Promise<void> {
	for (let index = 0; index < billings.length; index += BILLING_LIFECYCLE_CONCURRENCY) {
		await Promise.all(billings.slice(index, index + BILLING_LIFECYCLE_CONCURRENCY).map(provisionOrganizationTrial));
	}
}

async function provisionOrganizationTrial(
	billing: Awaited<ReturnType<typeof billingQueries.listOrganizationTrialsPendingStripeProvisioning>>[number],
): Promise<void> {
	try {
		await provisionCloudTrial(billing.orgId);
	} catch (error) {
		logger.error(`Cloud trial provisioning recovery failed for organization ${billing.orgId}`, {
			source: 'system',
			context: serializeError(error),
		});
	}
}

async function reconcileMappedOrganizations(provisionedOrganizationIds: Set<string>): Promise<void> {
	const billings = (await billingQueries.listOrganizationBillingsWithStripeCustomers()).filter(
		(billing) => !provisionedOrganizationIds.has(billing.orgId),
	);
	for (let index = 0; index < billings.length; index += BILLING_LIFECYCLE_CONCURRENCY) {
		await Promise.all(billings.slice(index, index + BILLING_LIFECYCLE_CONCURRENCY).map(reconcileOrganization));
	}
}

async function reconcileOrganization(
	billing: Awaited<ReturnType<typeof billingQueries.listOrganizationBillingsWithStripeCustomers>>[number],
): Promise<void> {
	if (!billing.stripeCustomerId) {
		return;
	}
	try {
		await reconcileCloudBillingCustomer({
			stripeCustomerId: billing.stripeCustomerId,
			organizationIdHint: billing.orgId,
		});
	} catch (error) {
		logger.error(`Cloud billing reconciliation failed for organization ${billing.orgId}`, {
			source: 'system',
			context: serializeError(error),
		});
	}
}
