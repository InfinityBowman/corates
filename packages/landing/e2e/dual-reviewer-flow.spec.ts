/**
 * E2E Test: Dual-Reviewer AMSTAR2 Workflow
 *
 * Prerequisites:
 *   pnpm dev:workers  (localhost:8787, DEV_MODE=true)
 *   pnpm dev          (localhost:3010)
 */

import { test, expect } from '@playwright/test';
import {
  seedDualReviewerScenario,
  cleanupScenario,
  loginAs,
  switchUser,
  type DualReviewerScenario,
} from './helpers';

let scenario: DualReviewerScenario;

test.beforeAll(async () => {
  scenario = await seedDualReviewerScenario();
});

test.afterAll(async () => {
  if (scenario) {
    await cleanupScenario(scenario);
  }
});

test.describe.serial('Dual-Reviewer AMSTAR2 Workflow', () => {
  test('User A sees the dashboard after login', async ({ context, page }) => {
    await loginAs(context, scenario.cookiesA);
    await page.goto('/dashboard');

    // Dashboard loads with Alice's name and empty project state
    await expect(page.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Alice' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible();
  });
});
