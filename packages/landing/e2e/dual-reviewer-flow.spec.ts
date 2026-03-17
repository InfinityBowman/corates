/**
 * E2E Test: Dual-Reviewer AMSTAR2 Workflow
 *
 * Tests the complete happy path for a dual-reviewer systematic review.
 * This is a single long test because Playwright gives each test() a fresh
 * browser context -- the full workflow needs state continuity.
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

test('Dual-Reviewer AMSTAR2 Workflow', async ({ context, page }) => {
  // ================================================================
  // Phase 1: User A creates a project
  // ================================================================
  await loginAs(context, scenario.cookiesA);
  await page.goto('/dashboard');
  await expect(page.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });

  // Create project
  await page.getByRole('button', { name: /Create First Project/i }).click();
  await expect(page.getByText('Create a new project')).toBeVisible();
  await page.getByPlaceholder('My Systematic Review').fill('E2E Test Review');
  await page.getByPlaceholder('What is this review about?').fill('Dual-reviewer workflow test');
  await page.getByRole('button', { name: 'Create Project' }).click();

  // Wait for navigation to project page
  await expect(page).toHaveURL(/\/projects\//, { timeout: 15_000 });

  // Take screenshot of project page before continuing
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/debug-project-page.png' });

  // BUG: The project page crashes with "Maximum update depth exceeded"
  // (infinite setState loop). This needs to be fixed before continuing
  // with the rest of the workflow (add study, assign reviewers, etc.).
  // The crash was discovered by this e2e test.

  // TODO(agent): Continue the workflow once the project page bug is fixed:
  // Phase 2: Add a study via DOI lookup
  // Phase 3: Assign reviewers
  // Phase 4: User A fills AMSTAR2 checklist, marks complete
  // Phase 5: Switch to User B, fill checklist, mark complete
  // Phase 6: Reconciliation
  // Phase 7: Verify completed checklist
});
