import { eq, sql } from 'drizzle-orm';

import s, { type DBCreditWallet, type DBManagedAiUsage, type NewManagedAiUsage } from '../db/abstractSchema';
import { db } from '../db/db';
import dbConfig, { Dialect } from '../db/dbConfig';

export const WELCOME_GRANT_MICRO_USD = 5_000_000;

/**
 * Every user brings one welcome grant to the organization they first use managed AI in.
 * The ledger key is per user, so later organizations and repeated calls add nothing.
 */
export async function claimWelcomeGrant(orgId: string, userId: string): Promise<DBCreditWallet> {
	if (dbConfig.dialect === Dialect.Sqlite) {
		return db.transaction(
			(transaction) => {
				transaction.insert(s.creditWallet).values({ orgId }).onConflictDoNothing().run();
				const wallet = transaction.select().from(s.creditWallet).where(eq(s.creditWallet.orgId, orgId)).get();
				if (!wallet) {
					throw new Error(`Credit wallet could not be created for organization ${orgId}.`);
				}
				const entry = transaction
					.insert(s.creditLedger)
					.values(welcomeGrantEntry(wallet, userId))
					.onConflictDoNothing()
					.returning()
					.get();
				if (!entry) {
					return wallet;
				}
				const updated = transaction
					.update(s.creditWallet)
					.set({
						balanceMicroUsd: sql`${s.creditWallet.balanceMicroUsd} + ${WELCOME_GRANT_MICRO_USD}`,
						updatedAt: new Date(),
					})
					.where(eq(s.creditWallet.id, wallet.id))
					.returning()
					.get();
				if (!updated) {
					throw new Error(`Credit wallet ${wallet.id} could not be updated.`);
				}
				return updated;
			},
			{ behavior: 'immediate' },
		);
	}

	return db.transaction(async (transaction) => {
		await transaction.insert(s.creditWallet).values({ orgId }).onConflictDoNothing().execute();
		const [wallet] = await transaction
			.select()
			.from(s.creditWallet)
			.where(eq(s.creditWallet.orgId, orgId))
			.limit(1);
		if (!wallet) {
			throw new Error(`Credit wallet could not be created for organization ${orgId}.`);
		}

		const [entry] = await transaction
			.insert(s.creditLedger)
			.values(welcomeGrantEntry(wallet, userId))
			.onConflictDoNothing()
			.returning()
			.execute();
		if (!entry) {
			return wallet;
		}

		const [updated] = await transaction
			.update(s.creditWallet)
			.set({
				balanceMicroUsd: sql`${s.creditWallet.balanceMicroUsd} + ${WELCOME_GRANT_MICRO_USD}`,
				updatedAt: new Date(),
			})
			.where(eq(s.creditWallet.id, wallet.id))
			.returning()
			.execute();
		if (!updated) {
			throw new Error(`Credit wallet ${wallet.id} could not be updated.`);
		}
		return updated;
	});
}

export async function recordManagedAiUsageAndChargeWallet(
	usage: Omit<NewManagedAiUsage, 'id' | 'walletId' | 'isManaged'>,
	customerChargeMicroUsd: number,
): Promise<DBManagedAiUsage | null> {
	const billedOrgId = usage.orgId;
	if (!billedOrgId) {
		throw new Error('Managed AI usage requires a billed organization.');
	}
	if (dbConfig.dialect === Dialect.Sqlite) {
		return db.transaction(
			(transaction) => {
				const wallet = transaction
					.select()
					.from(s.creditWallet)
					.where(eq(s.creditWallet.orgId, billedOrgId))
					.get();
				if (!wallet) {
					throw new Error(`Managed AI usage has no wallet for organization ${billedOrgId}.`);
				}
				const created = transaction
					.insert(s.managedAiUsage)
					.values({ ...usage, walletId: wallet.id, isManaged: true, customerChargeMicroUsd })
					.onConflictDoNothing()
					.returning()
					.get();
				if (!created || customerChargeMicroUsd <= 0) {
					return created ?? null;
				}
				const updated = transaction
					.update(s.creditWallet)
					.set({
						balanceMicroUsd: sql`${s.creditWallet.balanceMicroUsd} - ${customerChargeMicroUsd}`,
						updatedAt: new Date(),
					})
					.where(eq(s.creditWallet.id, wallet.id))
					.returning()
					.get();
				if (!updated) {
					throw new Error(`Credit wallet ${wallet.id} could not be charged.`);
				}
				transaction
					.insert(s.creditLedger)
					.values(usageLedgerEntry(created.id, usage.operationId, customerChargeMicroUsd, updated))
					.run();
				return created;
			},
			{ behavior: 'immediate' },
		);
	}

	return db.transaction(async (transaction) => {
		const [wallet] = await transaction
			.select()
			.from(s.creditWallet)
			.where(eq(s.creditWallet.orgId, billedOrgId))
			.limit(1);
		if (!wallet) {
			throw new Error(`Managed AI usage has no wallet for organization ${billedOrgId}.`);
		}

		const [created] = await transaction
			.insert(s.managedAiUsage)
			.values({
				...usage,
				walletId: wallet.id,
				isManaged: true,
				customerChargeMicroUsd,
			})
			.onConflictDoNothing()
			.returning()
			.execute();
		if (!created || customerChargeMicroUsd <= 0) {
			return created ?? null;
		}

		const [updated] = await transaction
			.update(s.creditWallet)
			.set({
				balanceMicroUsd: sql`${s.creditWallet.balanceMicroUsd} - ${customerChargeMicroUsd}`,
				updatedAt: new Date(),
			})
			.where(eq(s.creditWallet.id, wallet.id))
			.returning()
			.execute();
		if (!updated) {
			throw new Error(`Credit wallet ${wallet.id} could not be charged.`);
		}
		await transaction
			.insert(s.creditLedger)
			.values(usageLedgerEntry(created.id, usage.operationId, customerChargeMicroUsd, updated))
			.execute();
		return created;
	});
}

function welcomeGrantEntry(wallet: DBCreditWallet, userId: string) {
	return {
		walletId: wallet.id,
		entryType: 'gift' as const,
		deltaMicroUsd: WELCOME_GRANT_MICRO_USD,
		balanceAfterMicroUsd: wallet.balanceMicroUsd + WELCOME_GRANT_MICRO_USD,
		idempotencyKey: `welcome-user:v1:${userId}`,
		metadata: { source: 'nao', campaign: 'v1-welcome-user', grantedForUserId: userId },
	};
}

function usageLedgerEntry(
	usageId: string,
	operationId: string,
	customerChargeMicroUsd: number,
	wallet: DBCreditWallet,
) {
	return {
		walletId: wallet.id,
		usageId,
		entryType: 'usage' as const,
		deltaMicroUsd: -customerChargeMicroUsd,
		balanceAfterMicroUsd: wallet.balanceMicroUsd,
		idempotencyKey: operationId,
	};
}
