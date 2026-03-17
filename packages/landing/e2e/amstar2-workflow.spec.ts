/**
 * E2E Test: Dual-Reviewer AMSTAR2 Workflow
 *
 * Full happy path: create project, add study, assign reviewers,
 * both reviewers fill AMSTAR2 checklists, reconcile, finalize.
 *
 * Prerequisites:
 *   pnpm dev:workers  (localhost:8787, DEV_MODE=true)
 *   pnpm dev          (localhost:3010)
 */

import { test, expect } from '@playwright/test';
import {
  seedDualReviewerScenario,
  cleanupScenario,
  switchUser,
  type DualReviewerScenario,
} from './helpers';
import { setupProjectWithStudy, markChecklistComplete } from './shared-steps';

let scenario: DualReviewerScenario;

test.beforeAll(async () => {
  scenario = await seedDualReviewerScenario();
});

test.afterAll(async () => {
  if (scenario) await cleanupScenario(scenario);
});

test('Dual-Reviewer AMSTAR2 Workflow', async ({ context, page }) => {
  const projectId = await setupProjectWithStudy(context, page, scenario, 'AMSTAR2 E2E Test');

  // ================================================================
  // User A fills AMSTAR2 checklist
  // ================================================================
  await page.getByRole('tab', { name: /To Do/i }).click();
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: /Select Checklist/i }).click();
  await page.getByRole('button', { name: /Add Checklist/i }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /Open/i }).click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await page.waitForTimeout(2000);

  // Answer all questions "Yes"
  const yesRadios = page.getByRole('radio', { name: 'Yes' });
  const count = await yesRadios.count();
  for (let i = 0; i < count; i++) {
    await yesRadios.nth(i).click();
  }
  await page.waitForTimeout(1000);

  await markChecklistComplete(page);
  await page.goto(`/projects/${projectId}`);
  await page.waitForTimeout(2000);

  // ================================================================
  // User B fills AMSTAR2 checklist
  // ================================================================
  await switchUser(context, scenario.cookiesB);
  await page.goto(`/projects/${projectId}`);
  await page.waitForTimeout(3000);

  await page.getByRole('tab', { name: /To Do/i }).click();
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: /Select Checklist/i }).click();
  await page.getByRole('button', { name: /Add Checklist/i }).click();
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: /Open/i }).last().click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await page.waitForTimeout(2000);

  // Handle read-only fallback
  if (
    await page
      .getByText('Read-only')
      .isVisible()
      .catch(() => false)
  ) {
    await page.goBack();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /Open/i }).first().click();
    await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
    await page.waitForTimeout(2000);
  }

  // Answer all questions "No"
  const noRadios = page.getByRole('radio', { name: 'No' });
  const noCount = await noRadios.count();
  for (let i = 0; i < noCount; i++) {
    await noRadios.nth(i).click();
  }
  await page.waitForTimeout(1000);

  await markChecklistComplete(page);
  await page.goto(`/projects/${projectId}`);
  await page.waitForTimeout(2000);

  // ================================================================
  // Reconciliation
  // ================================================================
  await page.getByRole('tab', { name: /Reconcile/i }).click();
  await page.waitForTimeout(2000);
  await expect(page.getByText('Ready')).toBeVisible({ timeout: 5_000 });

  await page.getByRole('button', { name: /Reconcile/i }).click();
  await expect(page).toHaveURL(/\/reconcile\//, { timeout: 10_000 });
  await page.waitForTimeout(2000);

  await expect(page.getByRole('heading', { name: 'Reconciliation' })).toBeVisible();
  await expect(page.getByText('Question 1 of 16')).toBeVisible();

  // Select Alice's answer for all 16 questions
  for (let q = 1; q <= 16; q++) {
    await expect(page.getByText(`Question ${q} of 16`)).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Use This' }).first().click();
    await page.waitForTimeout(300);
    if (q < 16) {
      await page.getByRole('button', { name: /Next/i }).click();
      await page.waitForTimeout(300);
    }
  }

  // Finalize
  await page.getByRole('button', { name: 'Review Summary' }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('Review Summary')).toBeVisible();

  const saveBtn = page.getByRole('button', { name: /Save Reconciled Checklist/i });
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();

  await expect(page.getByText('Finish reconciliation?')).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.waitForTimeout(3000);

  // ================================================================
  // Verify completed
  // ================================================================
  await page.goto(`/projects/${projectId}`);
  await page.waitForTimeout(2000);
  await page.getByRole('tab', { name: /Completed/i }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('Untitled Study')).toBeVisible({ timeout: 5_000 });
});
