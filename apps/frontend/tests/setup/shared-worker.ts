import { afterAll, vi } from 'vitest';

/**
 * Test files share their worker (`isolate: false`), so dependencies load once per worker instead of once per file.
 * Resetting the module registry still gives every file fresh app modules and its own mocks, and the hooks below
 * undo what a file may leave behind on the shared environment.
 */
vi.resetModules();

afterAll(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});
