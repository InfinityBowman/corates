import { defineConfig } from '@playwright/test';
import { BASE_URL } from './e2e/constants';

const isRemote = !!process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 180_000,
  retries: isRemote ? 1 : 0,
  // Test data is namespace-isolated per scenario (unique seed prefixes), so
  // spec files can run in parallel workers against the shared dev server.
  // The database is reset once per run in global-setup.ts, not per test.
  workers: isRemote ? 1 : 6,
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
      command: 'pnpm test:dev',
      url: `${BASE_URL}/api/test/health`,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  }),
});
