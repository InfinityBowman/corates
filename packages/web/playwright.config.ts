import { defineConfig } from '@playwright/test';
import { BASE_URL } from './e2e/constants';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 180_000,
  retries: 0,
  workers: 1,
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
  webServer: {
    command: 'pnpm test:dev',
    url: `${BASE_URL}/api/test/health`,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
