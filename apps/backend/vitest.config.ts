import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		{
			name: 'raw-markdown',
			enforce: 'pre',
			load(id) {
				if (id.endsWith('.md')) {
					return `export default ${JSON.stringify(readFileSync(id, 'utf8'))}`;
				}
			},
		},
	],
	resolve: {
		alias: {
			'bun:sqlite': fileURLToPath(new URL('./tests/stubs/bun-sqlite.ts', import.meta.url)),
		},
	},
	test: {
		include: ['tests/**/*.test.{ts,tsx}'],
		globalSetup: ['./tests/setup/sqlite-schema.ts'],
		server: {
			deps: {
				inline: [/drizzle-orm\/bun-sqlite/],
			},
		},
	},
});
