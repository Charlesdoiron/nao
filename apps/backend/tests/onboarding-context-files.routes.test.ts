import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	addHook: vi.fn(),
	post: vi.fn(),
	saveWarehouseContextFile: vi.fn(),
}));

vi.mock('../src/middleware/auth', () => ({
	authMiddleware: vi.fn(),
}));

vi.mock('../src/services/warehouse-context-files', () => ({
	MAX_WAREHOUSE_CONTEXT_FILE_SIZE_BYTES: 5 * 1024 * 1024,
	saveWarehouseContextFile: mocks.saveWarehouseContextFile,
}));

import { onboardingContextFileRoutes } from '../src/routes/onboarding-context-files';

describe('onboarding context file routes', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		await onboardingContextFileRoutes({
			addHook: mocks.addHook,
			post: mocks.post,
		} as never);
	});

	it('passes an uploaded file to the job-scoped storage service', async () => {
		const data = Buffer.from('# Company');
		const storedFile = {
			filename: 'company.md',
			path: 'docs/uploads/company.md',
			size: data.length,
		};
		mocks.saveWarehouseContextFile.mockResolvedValue(storedFile);

		const result = await handler()({
			query: { jobId: 'job-id' },
			user: { id: 'user-id' },
			file: vi.fn().mockResolvedValue({
				filename: 'company.md',
				file: { truncated: false },
				toBuffer: vi.fn().mockResolvedValue(data),
			}),
		});

		expect(mocks.saveWarehouseContextFile).toHaveBeenCalledWith('job-id', 'user-id', 'company.md', data);
		expect(result).toEqual(storedFile);
	});

	it('rejects a file truncated by the multipart size limit', async () => {
		await expect(
			handler()({
				query: { jobId: 'job-id' },
				user: { id: 'user-id' },
				file: vi.fn().mockResolvedValue({
					filename: 'large.md',
					file: { truncated: true },
					toBuffer: vi.fn().mockResolvedValue(Buffer.alloc(0)),
				}),
			}),
		).rejects.toMatchObject({
			code: 400,
			message: 'large.md is larger than the 5 MB upload limit',
		});
		expect(mocks.saveWarehouseContextFile).not.toHaveBeenCalled();
	});
});

function handler() {
	return mocks.post.mock.calls[0][2] as (request: {
		query: { jobId: string };
		user: { id: string };
		file: () => Promise<{
			filename: string;
			file: { truncated: boolean };
			toBuffer: () => Promise<Buffer>;
		}>;
	}) => Promise<unknown>;
}
