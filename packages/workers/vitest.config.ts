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
    setupFiles: ['./src/__tests__/setup.js'],
    poolOptions: {
      workers: {
        wrangler: {
          configPath: './wrangler.jsonc',
        },
        singleWorker: true,
        isolatedStorage: false,
      },
    },
    include: ['src/**/*.{test,spec}.{js,ts}'],
    testTimeout: 10000,
  },
});
