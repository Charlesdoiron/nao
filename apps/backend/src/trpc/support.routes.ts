import { TRPCError } from '@trpc/server';
import { z } from 'zod/v4';

import { emailService } from '../services/email';
import { protectedProcedure } from './trpc';

const SUPPORT_EMAIL = 'support@getnao.io';

export const supportRoutes = {
	submit: protectedProcedure
		.input(z.object({ request: z.string().trim().min(1).max(5000) }))
		.mutation(async ({ input, ctx }) => {
			if (!emailService.isEnabled()) {
				throw new TRPCError({
					code: 'PRECONDITION_FAILED',
					message: 'In-app support is not available on this deployment.',
				});
			}

			await emailService.sendEmail(
				SUPPORT_EMAIL,
				{
					subject: `Support request from ${ctx.user.name}`,
					html: buildSupportRequestEmail(ctx.user, input.request),
					replyTo: ctx.user.email,
				},
				{ throwOnError: true },
			);

			return { success: true };
		}),
};

function buildSupportRequestEmail(user: { name: string; email: string }, request: string): string {
	return [
		'<h1>Support request</h1>',
		`<p><strong>From:</strong> ${escapeHtml(user.name)} (${escapeHtml(user.email)})</p>`,
		`<p style="white-space:pre-wrap">${escapeHtml(request)}</p>`,
	].join('');
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}
