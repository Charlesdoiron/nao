import '../src/env';

import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import s from '../src/db/abstractSchema';
import { db } from '../src/db/db';
import { handleExampleAllowanceExhaustedRoute } from '../src/handlers/agent';
import * as chatQueries from '../src/queries/chat.queries';
import {
	EXAMPLE_CHAT_RUN_CAP,
	ONBOARDING_CHAT_RUN_CAP,
	releaseExampleChatRun,
} from '../src/queries/example-chat-allowance.queries';
import { assertExampleChatAllowance } from '../src/routes/agent';
import { SYSTEM_EXAMPLE_PROJECT_ID } from '../src/services/example-project';
import { ExampleAllowanceExhaustedError } from '../src/utils/error';

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

const ALLOWANCE_USER_ID = 'allowance-user';
const PROJECT_USER_ID = 'project-user';
const EXHAUSTED_USER_ID = 'exhausted-user';
const RECOVERABLE_USER_ID = 'recoverable-user';

describe('example chat allowance', () => {
	beforeAll(async () => {
		await db.insert(s.user).values([
			{ id: ALLOWANCE_USER_ID, name: 'Allowance User', email: 'allowance@example.com' },
			{ id: PROJECT_USER_ID, name: 'Project User', email: 'project@example.com' },
			{ id: EXHAUSTED_USER_ID, name: 'Exhausted User', email: 'exhausted@example.com' },
			{ id: RECOVERABLE_USER_ID, name: 'Recoverable User', email: 'recoverable@example.com' },
		]);
		await db.insert(s.project).values({
			id: SYSTEM_EXAMPLE_PROJECT_ID,
			orgId: null,
			name: 'Jaffle Shop',
			type: 'local',
			path: '/tmp/example-project',
		});
	});

	afterAll(() => {
		db.$client.close();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('keeps independent lifetime caps for example and onboarding submissions', async () => {
		await expect(
			assertExampleChatAllowance({
				userId: ALLOWANCE_USER_ID,
				projectId: SYSTEM_EXAMPLE_PROJECT_ID,
				isOnboarding: false,
			}),
		).resolves.toBe(true);
		for (let run = 1; run < EXAMPLE_CHAT_RUN_CAP; run += 1) {
			await assertExampleChatAllowance({
				userId: ALLOWANCE_USER_ID,
				projectId: SYSTEM_EXAMPLE_PROJECT_ID,
				isOnboarding: false,
			});
		}
		await expect(
			assertExampleChatAllowance({
				userId: ALLOWANCE_USER_ID,
				projectId: SYSTEM_EXAMPLE_PROJECT_ID,
				isOnboarding: false,
			}),
		).rejects.toMatchObject<Partial<ExampleAllowanceExhaustedError>>({ scope: 'example' });

		for (let run = 0; run < ONBOARDING_CHAT_RUN_CAP; run += 1) {
			await assertExampleChatAllowance({
				userId: ALLOWANCE_USER_ID,
				projectId: SYSTEM_EXAMPLE_PROJECT_ID,
				isOnboarding: true,
			});
		}
		await expect(
			assertExampleChatAllowance({
				userId: ALLOWANCE_USER_ID,
				projectId: SYSTEM_EXAMPLE_PROJECT_ID,
				isOnboarding: true,
			}),
		).rejects.toMatchObject<Partial<ExampleAllowanceExhaustedError>>({ scope: 'onboarding' });
	});

	it('restores a reserved run when setup fails before streaming', async () => {
		for (let run = 0; run < EXAMPLE_CHAT_RUN_CAP; run += 1) {
			await assertExampleChatAllowance({
				userId: RECOVERABLE_USER_ID,
				projectId: SYSTEM_EXAMPLE_PROJECT_ID,
				isOnboarding: false,
			});
		}
		await releaseExampleChatRun(RECOVERABLE_USER_ID, 'example');
		await expect(
			assertExampleChatAllowance({
				userId: RECOVERABLE_USER_ID,
				projectId: SYSTEM_EXAMPLE_PROJECT_ID,
				isOnboarding: false,
			}),
		).resolves.toBe(true);
	});

	it.each([
		{
			isOnboarding: false,
			source: 'web' as const,
			responseText:
				'You’ve finished the Jaffle Shop preview. [Set up your own project](/onboarding) to keep chatting. This conversation is saved.',
		},
		{
			isOnboarding: true,
			source: 'onboarding' as const,
			responseText:
				'You’ve reached the chat limit for guided setup. Your progress is safe, and the setup actions on this page still work. [Contact support](mailto:support@getnao.io) if you need help debugging your setup.',
		},
	])('persists and streams the rejected $source turn', async ({ isOnboarding, source, responseText }) => {
		const chatId = `exhausted-${isOnboarding ? 'onboarding' : 'example'}-chat`;
		const prompt = `Rejected ${isOnboarding ? 'onboarding' : 'example'} prompt`;
		vi.spyOn(chatQueries, 'getChatOwnerId').mockResolvedValue(EXHAUSTED_USER_ID);
		const upsertMessage = vi.spyOn(chatQueries, 'upsertMessage').mockResolvedValue({ messageId: 'message-id' });
		vi.spyOn(chatQueries, 'getChat').mockResolvedValue([{ id: chatId } as never]);

		const result = await handleExampleAllowanceExhaustedRoute({
			userId: EXHAUSTED_USER_ID,
			projectId: SYSTEM_EXAMPLE_PROJECT_ID,
			message: { text: prompt },
			chatId,
			isOnboarding,
		});
		const reader = result.stream.getReader();
		let streamedText = '';
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			if (value.type === 'text-delta') {
				streamedText += value.delta;
			}
		}

		expect(upsertMessage).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ role: 'user', source, parts: [{ type: 'text', text: prompt }] }),
		);
		expect(upsertMessage).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ role: 'assistant', source, parts: [{ type: 'text', text: responseText }] }),
		);
		expect(streamedText).toBe(responseText);
	});

	it('does not consume the allowance after the user has a real project', async () => {
		const orgId = 'project-org';
		await db.insert(s.organization).values({ id: orgId, name: 'Project Org', slug: orgId });
		await db.insert(s.orgMember).values({ orgId, userId: PROJECT_USER_ID, role: 'admin' });
		await db.insert(s.project).values({
			id: 'real-project',
			orgId,
			name: 'Real Project',
			type: 'local',
			path: '/tmp/real-project',
		});

		await expect(
			assertExampleChatAllowance({
				userId: PROJECT_USER_ID,
				projectId: SYSTEM_EXAMPLE_PROJECT_ID,
				isOnboarding: false,
			}),
		).resolves.toBe(false);

		const rows = await db
			.select()
			.from(s.exampleChatAllowance)
			.where(
				and(eq(s.exampleChatAllowance.userId, PROJECT_USER_ID), eq(s.exampleChatAllowance.scope, 'example')),
			);
		expect(rows).toHaveLength(0);
	});
});
