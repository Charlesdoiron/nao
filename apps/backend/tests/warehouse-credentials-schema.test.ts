import { requestWarehouseCredentials } from '@nao/shared/tools';
import { describe, expect, it } from 'vitest';

import { warehouseCredentialsSchema, warehouseProvisioningInputSchema } from '../src/types/warehouse';

describe('warehouse credentials schema', () => {
	it.each([...requestWarehouseCredentials.PROVIDERS])('accepts the %s credentials envelope', (provider) => {
		expect(
			warehouseCredentialsSchema.parse({
				provider,
				credentials: {},
			}),
		).toEqual({
			provider,
			credentials: {},
		});
	});

	it('requires a supported provider and credentials object', () => {
		expect(
			warehouseCredentialsSchema.safeParse({
				provider: 'unsupported',
				credentials: {},
			}).success,
		).toBe(false);

		expect(
			warehouseCredentialsSchema.safeParse({
				provider: 'postgres',
			}).success,
		).toBe(false);
	});

	it('derives the connection name instead of accepting one from the user', () => {
		expect(
			warehouseProvisioningInputSchema.safeParse({
				provider: 'postgres',
				credentials: {},
			}).success,
		).toBe(true);
	});

	it('accepts selected tables and rejects an empty selection', () => {
		expect(
			warehouseProvisioningInputSchema.parse({
				provider: 'postgres',
				credentials: {},
				tableSelection: {
					mode: 'selected',
					tables: [{ schema: 'public', table: 'orders' }],
				},
			}).tableSelection,
		).toEqual({
			mode: 'selected',
			tables: [{ schema: 'public', table: 'orders' }],
		});

		expect(
			warehouseProvisioningInputSchema.safeParse({
				provider: 'postgres',
				credentials: {},
				tableSelection: { mode: 'selected', tables: [] },
			}).success,
		).toBe(false);
	});

	it('accepts optional documentation context and rejects missing pages', () => {
		expect(
			warehouseProvisioningInputSchema.parse({
				provider: 'postgres',
				credentials: {},
				contextSources: {
					notion: {
						apiKey: 'secret',
						pages: ['https://notion.so/page'],
					},
					confluence: {
						baseUrl: 'https://acme.atlassian.net/wiki',
						email: 'person@acme.com',
						apiToken: 'secret',
						pages: ['123'],
					},
					github: {
						repoFullName: 'acme/analytics',
						branch: 'main',
					},
				},
			}).contextSources,
		).toEqual({
			notion: {
				apiKey: 'secret',
				pages: ['https://notion.so/page'],
			},
			confluence: {
				baseUrl: 'https://acme.atlassian.net/wiki',
				email: 'person@acme.com',
				apiToken: 'secret',
				pages: ['123'],
			},
			github: {
				repoFullName: 'acme/analytics',
				branch: 'main',
			},
		});

		expect(
			warehouseProvisioningInputSchema.safeParse({
				provider: 'postgres',
				credentials: {},
				contextSources: {
					notion: {
						apiKey: 'secret',
						pages: [],
					},
				},
			}).success,
		).toBe(false);

		expect(
			warehouseProvisioningInputSchema.safeParse({
				provider: 'postgres',
				credentials: {},
				contextSources: {
					github: {
						repoFullName: 'https://github.com/acme/analytics',
						branch: 'main',
					},
				},
			}).success,
		).toBe(false);
	});
});
