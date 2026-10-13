import { and, eq, gte, sql } from 'drizzle-orm';

import s, { type DBCreditWallet, type DBManagedAiUsage, type NewManagedAiUsage } from '../db/abstractSchema';
import { db } from '../db/db';
import dbConfig, { Dialect } from '../db/dbConfig';
import { ManagedCreditsExhaustedError } from '../utils/error';

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
						ledgerSequence: sql`${s.creditWallet.ledgerSequence} + 1`,
						updatedAt: new Date(),
					})
					.where(eq(s.creditWallet.id, wallet.id))
					.returning()
					.get();
				if (!updated) {
					throw new Error(`Credit wallet ${wallet.id} could not be updated.`);
				}
				transaction
					.update(s.creditLedger)
					.set({
						balanceAfterMicroUsd: updated.balanceMicroUsd,
						transactionSequence: updated.ledgerSequence,
					})
					.where(eq(s.creditLedger.id, entry.id))
					.run();
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
				ledgerSequence: sql`${s.creditWallet.ledgerSequence} + 1`,
				updatedAt: new Date(),
			})
			.where(eq(s.creditWallet.id, wallet.id))
			.returning()
			.execute();
		if (!updated) {
			throw new Error(`Credit wallet ${wallet.id} could not be updated.`);
		}
		await transaction
			.update(s.creditLedger)
			.set({
				balanceAfterMicroUsd: updated.balanceMicroUsd,
				transactionSequence: updated.ledgerSequence,
			})
			.where(eq(s.creditLedger.id, entry.id))
			.execute();
		return updated;
	});
}

export async function reserveManagedAiCredits(
	orgId: string,
	operationId: string,
	reservationMicroUsd: number,
): Promise<void> {
	if (!Number.isSafeInteger(reservationMicroUsd) || reservationMicroUsd <= 0) {
		throw new Error('Managed AI credit reservation must be a positive integer.');
	}
	if (dbConfig.dialect === Dialect.Sqlite) {
		return db.transaction(
			(transaction) => {
				const wallet = transaction
					.update(s.creditWallet)
					.set({
						balanceMicroUsd: sql`${s.creditWallet.balanceMicroUsd} - ${reservationMicroUsd}`,
						ledgerSequence: sql`${s.creditWallet.ledgerSequence} + 1`,
						updatedAt: new Date(),
					})
					.where(
						and(eq(s.creditWallet.orgId, orgId), gte(s.creditWallet.balanceMicroUsd, reservationMicroUsd)),
					)
					.returning()
					.get();
				if (!wallet) {
					throw new ManagedCreditsExhaustedError();
				}
				transaction
					.insert(s.creditLedger)
					.values(reservationLedgerEntry(wallet, operationId, reservationMicroUsd))
					.run();
			},
			{ behavior: 'immediate' },
		);
	}

	await db.transaction(async (transaction) => {
		const [wallet] = await transaction
			.update(s.creditWallet)
			.set({
				balanceMicroUsd: sql`${s.creditWallet.balanceMicroUsd} - ${reservationMicroUsd}`,
				ledgerSequence: sql`${s.creditWallet.ledgerSequence} + 1`,
				updatedAt: new Date(),
			})
			.where(and(eq(s.creditWallet.orgId, orgId), gte(s.creditWallet.balanceMicroUsd, reservationMicroUsd)))
			.returning()
			.execute();
		if (!wallet) {
			throw new ManagedCreditsExhaustedError();
		}
		await transaction
			.insert(s.creditLedger)
			.values(reservationLedgerEntry(wallet, operationId, reservationMicroUsd))
			.execute();
	});
}

export async function recordManagedAiUsageAndChargeWallet(
	usage: Omit<NewManagedAiUsage, 'id' | 'walletId' | 'isManaged'>,
	customerChargeMicroUsd: number,
): Promise<DBManagedAiUsage | null> {
	if (!Number.isSafeInteger(customerChargeMicroUsd) || customerChargeMicroUsd < 0) {
		throw new Error('Managed AI charge must be a non-negative integer.');
	}
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
				const reservation = transaction
					.select()
					.from(s.creditLedger)
					.where(
						and(
							eq(s.creditLedger.walletId, wallet.id),
							eq(s.creditLedger.idempotencyKey, usage.operationId),
						),
					)
					.get();
				if (!reservation) {
					throw new Error(`Managed AI usage ${usage.operationId} has no credit reservation.`);
				}
				const created = transaction
					.insert(s.managedAiUsage)
					.values({
						...usage,
						walletId: wallet.id,
						isManaged: true,
						customerChargeMicroUsd: Math.min(customerChargeMicroUsd, -reservation.deltaMicroUsd),
					})
					.onConflictDoNothing()
					.returning()
					.get();
				if (!created) {
					return created ?? null;
				}
				const settledChargeMicroUsd = created.customerChargeMicroUsd;
				const updated = transaction
					.update(s.creditWallet)
					.set({
						balanceMicroUsd: sql`${s.creditWallet.balanceMicroUsd} - ${reservation.deltaMicroUsd} - ${settledChargeMicroUsd}`,
						ledgerSequence: sql`${s.creditWallet.ledgerSequence} + 1`,
						updatedAt: new Date(),
					})
					.where(eq(s.creditWallet.id, wallet.id))
					.returning()
					.get();
				if (!updated) {
					throw new Error(`Credit wallet ${wallet.id} could not be charged.`);
				}
				transaction
					.update(s.creditLedger)
					.set({
						usageId: created.id,
						entryType: 'usage',
						deltaMicroUsd: -settledChargeMicroUsd,
						balanceAfterMicroUsd: updated.balanceMicroUsd,
						transactionSequence: updated.ledgerSequence,
						metadata: null,
					})
					.where(eq(s.creditLedger.id, reservation.id))
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
		const [reservation] = await transaction
			.select()
			.from(s.creditLedger)
			.where(and(eq(s.creditLedger.walletId, wallet.id), eq(s.creditLedger.idempotencyKey, usage.operationId)))
			.limit(1);
		if (!reservation) {
			throw new Error(`Managed AI usage ${usage.operationId} has no credit reservation.`);
		}

		const [created] = await transaction
			.insert(s.managedAiUsage)
			.values({
				...usage,
				walletId: wallet.id,
				isManaged: true,
				customerChargeMicroUsd: Math.min(customerChargeMicroUsd, -reservation.deltaMicroUsd),
			})
			.onConflictDoNothing()
			.returning()
			.execute();
		if (!created) {
			return created ?? null;
		}
		const settledChargeMicroUsd = created.customerChargeMicroUsd;

		const [updated] = await transaction
			.update(s.creditWallet)
			.set({
				balanceMicroUsd: sql`${s.creditWallet.balanceMicroUsd} - ${reservation.deltaMicroUsd} - ${settledChargeMicroUsd}`,
				ledgerSequence: sql`${s.creditWallet.ledgerSequence} + 1`,
				updatedAt: new Date(),
			})
			.where(eq(s.creditWallet.id, wallet.id))
			.returning()
			.execute();
		if (!updated) {
			throw new Error(`Credit wallet ${wallet.id} could not be charged.`);
		}
		await transaction
			.update(s.creditLedger)
			.set({
				usageId: created.id,
				entryType: 'usage',
				deltaMicroUsd: -settledChargeMicroUsd,
				balanceAfterMicroUsd: updated.balanceMicroUsd,
				transactionSequence: updated.ledgerSequence,
				metadata: null,
			})
			.where(eq(s.creditLedger.id, reservation.id))
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
		transactionSequence: 0,
		idempotencyKey: `welcome-user:v1:${userId}`,
		metadata: { source: 'nao', campaign: 'v1-welcome-user', grantedForUserId: userId },
	};
}

function reservationLedgerEntry(wallet: DBCreditWallet, operationId: string, reservationMicroUsd: number) {
	return {
		walletId: wallet.id,
		entryType: 'reservation' as const,
		deltaMicroUsd: -reservationMicroUsd,
		balanceAfterMicroUsd: wallet.balanceMicroUsd,
		transactionSequence: wallet.ledgerSequence,
		idempotencyKey: operationId,
		metadata: { source: 'nao', operationId },
	};
}
