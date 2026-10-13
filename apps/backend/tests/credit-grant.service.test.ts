import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../src/env', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../src/env')>();
	return { ...actual, isCloud: true };
});

vi.mock('../src/db/db', async () => {
	const { default: Database } = await import('better-sqlite3');
	const { drizzle } = await import('drizzle-orm/better-sqlite3');
	const { generateSQLiteDrizzleJson, generateSQLiteMigration } = await import('drizzle-kit/api');
	const sqliteSchema = await import('../src/db/sqlite-schema');

	const sqlite = new Database(':memory:');
	const statements = await generateSQLiteMigration(
		await generateSQLiteDrizzleJson({}),
		await generateSQLiteDrizzleJson(sqliteSchema),
	);
	for (const statement of statements) {
		sqlite.exec(statement);
	}
	sqlite.pragma('foreign_keys = ON');

	return { db: drizzle(sqlite, { schema: sqliteSchema }) };
});

import s from '../src/db/abstractSchema';
import { db } from '../src/db/db';
import { getCreditGrant, getCreditSummary } from '../src/queries/credit-wallet.queries';
import {
	activateUserJoinCandidates,
	reconcileOrganizationSetupGrant,
	recordOrganizationJoinCandidate,
	recordOrganizationSetupCandidate,
	recordProjectJoinCandidate,
} from '../src/services/credit-grant.service';
import { logger } from '../src/utils/logger';

const tempDirectories: string[] = [];

describe('automatic credit grants', () => {
	beforeAll(async () => {
		await db.insert(s.creditGrantPolicy).values([
			{ grantType: 'organization_setup', amountMicroUsd: 20_000_000 },
			{ grantType: 'user_join', amountMicroUsd: 5_000_000 },
		]);
	});

	afterAll(() => {
		db.$client.close();
		for (const directory of tempDirectories) {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('defers the organization grant until a customer project is configured and awards it once', async () => {
		const projectPath = createProjectDirectory('setup', true);
		await insertOrganizationAndProject('setup-org', 'setup-project', projectPath, {});

		await recordOrganizationSetupCandidate('setup-project');
		expect(await getCreditGrant('organization_setup', 'setup-org')).toBeNull();

		await db
			.update(s.project)
			.set({ envVars: { DATABASE_URL: 'sqlite:///warehouse.db' } })
			.where(eq(s.project.id, 'setup-project'));
		await reconcileOrganizationSetupGrant('setup-project');
		await reconcileOrganizationSetupGrant('setup-project');

		expect(await getCreditSummary('setup-org')).toEqual({
			balanceMicroUsd: 20_000_000,
			lifetimeCreditedMicroUsd: 20_000_000,
			lifetimeDebitedMicroUsd: 0,
		});
		expect(await getCreditGrant('organization_setup', 'setup-org')).toEqual({ orgId: 'setup-org' });
	});

	it('awards an active organization member once they have inherited project access', async () => {
		await insertReadyFundedOrganization('active-org', 'active-project');
		await db.insert(s.user).values({
			id: 'active-user',
			name: 'Active User',
			email: 'active@example.com',
		});
		await db.insert(s.orgMember).values({
			orgId: 'active-org',
			userId: 'active-user',
			role: 'user',
		});

		await recordOrganizationJoinCandidate('active-org', 'active-user');
		await recordOrganizationJoinCandidate('active-org', 'active-user');

		expect(await getCreditGrant('user_join', 'active-user')).toEqual({ orgId: 'active-org' });
		expect((await getCreditSummary('active-org')).balanceMicroUsd).toBe(25_000_000);
	});

	it('keeps a provisioned project member pending until authentication', async () => {
		await insertReadyFundedOrganization('invited-org', 'invited-project');
		await db.insert(s.user).values({
			id: 'invited-user',
			name: 'Invited User',
			email: 'invited@example.com',
			requiresPasswordReset: true,
		});
		await db.insert(s.projectMember).values({
			projectId: 'invited-project',
			userId: 'invited-user',
			role: 'user',
		});

		await recordProjectJoinCandidate('invited-project', 'invited-user');
		expect(await getCreditGrant('user_join', 'invited-user')).toBeNull();

		await activateUserJoinCandidates('invited-user');

		expect(await getCreditGrant('user_join', 'invited-user')).toEqual({ orgId: 'invited-org' });
		expect((await getCreditSummary('invited-org')).balanceMicroUsd).toBe(25_000_000);
	});

	it('reads the current database policy without changing earlier gifts', async () => {
		await insertReadyFundedOrganization('policy-org', 'policy-project');
		await db
			.update(s.creditGrantPolicy)
			.set({ amountMicroUsd: 6_000_000 })
			.where(eq(s.creditGrantPolicy.grantType, 'user_join'));
		await db.insert(s.user).values({
			id: 'later-user',
			name: 'Later User',
			email: 'later@example.com',
		});
		await db.insert(s.orgMember).values({
			orgId: 'policy-org',
			userId: 'later-user',
			role: 'user',
		});

		await recordOrganizationJoinCandidate('policy-org', 'later-user');

		expect(await getCreditGrant('user_join', 'later-user')).toEqual({ orgId: 'policy-org' });
		expect((await getCreditSummary('policy-org')).balanceMicroUsd).toBe(26_000_000);
	});

	it('does not fail the originating operation when grant reconciliation fails', async () => {
		const projectPath = createProjectDirectory('best-effort', false);
		await insertOrganizationAndProject('best-effort-org', 'best-effort-project', projectPath, {});
		await db
			.update(s.creditGrantPolicy)
			.set({ amountMicroUsd: 0 })
			.where(eq(s.creditGrantPolicy.grantType, 'organization_setup'));
		const errorLog = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

		try {
			await expect(recordOrganizationSetupCandidate('best-effort-project')).resolves.toBeUndefined();
			expect(await getCreditGrant('organization_setup', 'best-effort-org')).toBeNull();
			expect(errorLog).toHaveBeenCalledOnce();
		} finally {
			await db
				.update(s.creditGrantPolicy)
				.set({ amountMicroUsd: 20_000_000 })
				.where(eq(s.creditGrantPolicy.grantType, 'organization_setup'));
		}
	});
});

async function insertOrganizationAndProject(
	orgId: string,
	projectId: string,
	projectPath: string,
	envVars: Record<string, string>,
) {
	await db.insert(s.organization).values({ id: orgId, name: orgId, slug: orgId });
	await db.insert(s.project).values({
		id: projectId,
		orgId,
		name: projectId,
		type: 'local',
		path: projectPath,
		envVars,
	});
}

async function insertReadyFundedOrganization(orgId: string, projectId: string): Promise<void> {
	const projectPath = createProjectDirectory(projectId, false);
	await insertOrganizationAndProject(orgId, projectId, projectPath, {});
	await recordOrganizationSetupCandidate(projectId);
}

function createProjectDirectory(name: string, requiresEnvironmentVariable: boolean): string {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), `nao-credit-${name}-`));
	tempDirectories.push(directory);
	fs.writeFileSync(
		path.join(directory, 'nao_config.yaml'),
		requiresEnvironmentVariable
			? 'project_name: Test\ndatabases:\n  - name: warehouse\n    connection: "{{ env(\'DATABASE_URL\') }}"\n'
			: 'project_name: Test\n',
	);
	return directory;
}
