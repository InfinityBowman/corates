import { defineConfig } from '@playwright/test';
import { BASE_URL } from './e2e/constants';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 180_000,
  retries: 0,
  workers: 1, // Sequential -- tests share backend state
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
});
