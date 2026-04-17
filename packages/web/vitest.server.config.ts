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
