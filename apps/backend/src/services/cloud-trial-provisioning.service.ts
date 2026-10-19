import * as billingQueries from '../queries/billing.queries';
import * as organizationQueries from '../queries/organization.queries';
import { reconcileCloudBillingCustomer } from './billing-reconciliation.service';
import {
	cloudSubscriptionKind,
	createCloudCustomer,
	createCloudTrialPlaceholderSubscription,
	listCloudSubscriptions,
} from './stripe.service';

export async function provisionCloudTrial(organizationId: string): Promise<void> {
	const organization = await billingQueries.getOrganizationWithBilling(organizationId);
	if (!organization) {
		throw new Error(`Organization "${organizationId}" was not found`);
	}
	const billing = organization.billing;
	if (
		organization.bypassBilling ||
		billing?.billingStatus !== 'trialing' ||
		!billing.trialEndsAt ||
		billing.trialEndsAt.getTime() <= Date.now()
	) {
		return;
	}

	const stripeCustomerId = billing.stripeCustomerId ?? (await createAndAttachCustomer(organization));
	const subscriptions = await listCloudSubscriptions(stripeCustomerId);
	if (subscriptions.length === 0) {
		await createCloudTrialPlaceholderSubscription({
			organizationId,
			stripeCustomerId,
			trialEnd: billing.trialEndsAt,
		});
	} else {
		const kinds = await Promise.all(subscriptions.map(cloudSubscriptionKind));
		if (kinds.some((kind) => kind === 'paid-cloud')) {
			await reconcileCloudBillingCustomer({ stripeCustomerId, organizationIdHint: organizationId });
			return;
		}
	}

	await reconcileCloudBillingCustomer({ stripeCustomerId, organizationIdHint: organizationId });
}

async function createAndAttachCustomer(organization: billingQueries.OrganizationWithBilling): Promise<string> {
	const admin = await organizationQueries.getEarliestOrganizationAdmin(organization.id);
	if (!admin) {
		throw new Error(`Organization "${organization.id}" has no admin email for Stripe Customer creation`);
	}
	const customer = await createCloudCustomer({
		organizationId: organization.id,
		organizationName: organization.name,
		adminEmail: admin.email,
	});
	const billing = await billingQueries.attachStripeCustomer(organization.id, customer.id);
	if (!billing.stripeCustomerId) {
		throw new Error(`Unable to attach Stripe Customer "${customer.id}" to organization "${organization.id}"`);
	}
	return billing.stripeCustomerId;
}
