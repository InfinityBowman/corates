import { defineConfig } from '@playwright/test';
import { BASE_URL } from './e2e/constants';

const isRemote = !!process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 180_000,
  // Remote runs cross the public internet from a self-hosted runner, so a
  // test may lose a connection through no fault of its own. Every spec seeds
  // its own data in beforeAll, which runs again in the retry's fresh worker.
  retries: isRemote ? 2 : 0,
  // Test data is namespace-isolated per scenario (unique seed prefixes), so
  // spec files can run in parallel workers against the shared dev server.
  // The database is reset once per run in global-setup.ts, not per test.
  workers: isRemote ? 4 : 6,
  // CI defaults to the dot reporter, which shows no per-spec durations. The
  // JSON file feeds scripts/e2e-summary.mjs for the job summary.
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  ...(!isRemote && {
    webServer: {
      command: 'pnpm dev:test',
      url: `${BASE_URL}/api/test/health`,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  }),
});
