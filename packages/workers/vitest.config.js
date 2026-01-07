import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import { resolve } from 'path';

export default defineWorkersConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    pool: '@cloudflare/vitest-pool-workers',
    // Global test setup file that runs before all tests
    setupFiles: ['./src/__tests__/setup.js'],
    poolOptions: {
      workers: {
        wrangler: {
          configPath: './wrangler.jsonc',
        },
        // Run tests serially in a single worker to avoid network address conflicts
        // This prevents EADDRNOTAVAIL errors when multiple test processes try to bind to ports
        singleWorker: true,
        // Disable isolated storage to avoid Durable Object cleanup issues
        // Tests should still be isolated via beforeEach database resets
        isolatedStorage: false,
      },
    },
    include: ['src/**/*.{test,spec}.js'],
    // Increase test timeout for Durable Object operations
    testTimeout: 10000,
  },
});
