import type { LlmSelectedModel } from '@nao/shared/types';
import { NoObjectGeneratedError } from 'ai';
import { z } from 'zod/v4';

import type { App } from '../app';
import { noProjectMessage } from '../env';
import { authMiddleware } from '../middleware/auth';
import { testAgentService } from '../services/test-agent.service';
import { evaluateTestAttempt } from '../services/test-evaluation.service';
import { customModelCostSchema, llmSelectedModelSchema } from '../types/llm';
import { testAssertionSchema, testComparisonTolerancesSchema } from '../types/test-run';
import { truncateMiddle } from '../utils/utils';

const describeRunError = (err: unknown): string => {
	if (!NoObjectGeneratedError.isInstance(err)) {
		return err instanceof Error ? err.message : 'Unknown error';
	}

	const details = [
		`finishReason=${err.finishReason ?? 'unknown'}`,
		`outputTokens=${err.usage?.outputTokens ?? 'unknown'}`,
		`text=${JSON.stringify(truncateMiddle(err.text ?? '', 500))}`,
	].join(', ');

	return `${err.message} (${details})`;
};

export const testRoutes = async (app: App) => {
	app.addHook('preHandler', authMiddleware);

	/**
	 * Run a single prompt without persisting to a chat.
	 * Used for testing/evaluation purposes from the CLI.
	 */
	app.post(
		'/run',
		{
			schema: {
				body: z.object({
					prompt: z.string(),
					model: llmSelectedModelSchema,
					sql: z.string().optional(),
					databaseId: z.string().optional(),
					assertions: z.array(testAssertionSchema).default([]),
					comparison: testComparisonTolerancesSchema.optional(),
					meta: z
						.object({
							costs: customModelCostSchema,
						})
						.optional(),
				}),
			},
		},
		async (request, reply) => {
			const projectId = request.project?.id;
			const userId = request.user.id;
			const { prompt, model, sql, databaseId, assertions, comparison, meta } = request.body;

			const costs = meta?.costs;

			if (!projectId) {
				return reply.status(400).send({ error: noProjectMessage() });
			}

			try {
				const modelSelection = model as LlmSelectedModel | undefined;
				const result = await testAgentService.runTest(projectId, userId, prompt, modelSelection, costs);
				const { toolCalls, verification, verdict } = await evaluateTestAttempt({
					projectId,
					userId,
					test: { prompt, sql, databaseId, assertions, tolerances: comparison },
					result,
					modelSelection,
				});

				return reply.send({
					text: result.text,
					toolCalls,
					usage: result.usage,
					cost: result.cost,
					finishReason: result.finishReason,
					durationMs: result.durationMs,
					verification,
					verdict,
				});
			} catch (err) {
				return reply.status(500).send({ error: describeRunError(err) });
			}
		},
	);
};
