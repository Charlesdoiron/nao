import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';

import type { DBCreditGrantCandidate, NewCreditGrantCandidate } from '../db/abstractSchema';
import s from '../db/abstractSchema';
import { db } from '../db/db';

export async function listPendingOrganizationSetupCandidates(): Promise<
	Array<{ orgId: string | null; projectId: string | null }>
> {
	return db
		.selectDistinct({
			orgId: s.creditGrantCandidate.orgId,
			projectId: s.creditGrantCandidate.projectId,
		})
		.from(s.creditGrantCandidate)
		.leftJoin(s.creditWallet, eq(s.creditWallet.orgId, s.creditGrantCandidate.orgId))
		.leftJoin(
			s.creditLedger,
			and(eq(s.creditLedger.walletId, s.creditWallet.id), eq(s.creditLedger.grantType, 'organization_setup')),
		)
		.where(
			and(
				eq(s.creditGrantCandidate.grantType, 'organization_setup'),
				isNotNull(s.creditGrantCandidate.orgId),
				isNotNull(s.creditGrantCandidate.projectId),
				isNull(s.creditLedger.id),
			),
		)
		.execute();
}

export async function addCreditGrantCandidate(candidate: NewCreditGrantCandidate): Promise<void> {
	await db.insert(s.creditGrantCandidate).values(candidate).onConflictDoNothing().execute();
}

export async function getOrganizationSetupCandidate(projectId: string): Promise<DBCreditGrantCandidate | null> {
	const [candidate] = await db
		.select()
		.from(s.creditGrantCandidate)
		.where(
			and(
				eq(s.creditGrantCandidate.grantType, 'organization_setup'),
				eq(s.creditGrantCandidate.projectId, projectId),
			),
		)
		.limit(1)
		.execute();
	return candidate ?? null;
}

export async function hasUserJoinCandidate(userId: string): Promise<boolean> {
	const [candidate] = await db
		.select({ id: s.creditGrantCandidate.id })
		.from(s.creditGrantCandidate)
		.where(and(eq(s.creditGrantCandidate.grantType, 'user_join'), eq(s.creditGrantCandidate.userId, userId)))
		.limit(1)
		.execute();
	return Boolean(candidate);
}

export async function activateUserJoinCandidates(userId: string): Promise<void> {
	await db
		.update(s.creditGrantCandidate)
		.set({ activatedAt: new Date() })
		.where(
			and(
				eq(s.creditGrantCandidate.grantType, 'user_join'),
				eq(s.creditGrantCandidate.userId, userId),
				isNull(s.creditGrantCandidate.activatedAt),
			),
		)
		.execute();
}

export async function listActivatedUserJoinCandidates(userId: string): Promise<DBCreditGrantCandidate[]> {
	return db
		.select()
		.from(s.creditGrantCandidate)
		.where(
			and(
				eq(s.creditGrantCandidate.grantType, 'user_join'),
				eq(s.creditGrantCandidate.userId, userId),
				isNotNull(s.creditGrantCandidate.activatedAt),
			),
		)
		.orderBy(asc(s.creditGrantCandidate.createdAt), asc(s.creditGrantCandidate.id))
		.execute();
}

export async function listActivatedUserJoinCandidateUserIds(orgId?: string): Promise<string[]> {
	const candidates = await db
		.selectDistinct({ userId: s.creditGrantCandidate.userId })
		.from(s.creditGrantCandidate)
		.where(
			and(
				eq(s.creditGrantCandidate.grantType, 'user_join'),
				orgId ? eq(s.creditGrantCandidate.orgId, orgId) : undefined,
				isNotNull(s.creditGrantCandidate.userId),
				isNotNull(s.creditGrantCandidate.activatedAt),
			),
		)
		.execute();
	return candidates.flatMap(({ userId }) => (userId ? [userId] : []));
}

export async function listOrganizationSetupCandidateProjectIds(orgId: string): Promise<string[]> {
	const candidates = await db
		.select({ projectId: s.creditGrantCandidate.projectId })
		.from(s.creditGrantCandidate)
		.where(
			and(
				eq(s.creditGrantCandidate.grantType, 'organization_setup'),
				eq(s.creditGrantCandidate.orgId, orgId),
				isNotNull(s.creditGrantCandidate.projectId),
			),
		)
		.execute();
	return candidates.flatMap(({ projectId }) => (projectId ? [projectId] : []));
}
