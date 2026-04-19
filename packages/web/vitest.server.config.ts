import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: './wrangler.test.jsonc',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // Stand-ins for the virtual modules the tanstackStart vite plugin would
      // generate. We don't run that plugin in the test pool — these aliases
      // let createStartHandler boot inside the test-worker so SELF.fetch can
      // exercise the real route -> middleware -> handler chain.
      '#tanstack-router-entry': resolve(__dirname, 'src/router.tsx'),
      '#tanstack-start-entry': resolve(__dirname, 'src/__tests__/server/tanstack-start-entry.ts'),
      '#tanstack-start-plugin-adapters': resolve(
        __dirname,
        'src/__tests__/server/tanstack-start-plugin-adapters.ts',
      ),
    },
  },
  test: {
    globals: true,
    setupFiles: ['./src/__tests__/server/setup.ts'],
    include: ['src/**/*.server.test.ts'],
    testTimeout: 10000,
    retry: 2,
  },
});
