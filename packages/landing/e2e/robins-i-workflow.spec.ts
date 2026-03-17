/**
 * E2E Test: Dual-Reviewer ROBINS-I Workflow
 *
 * ROBINS-I requires outcomes, uses toggle buttons (Y/PY/PN/N/NI),
 * has domain sections (D1-D6), and requires an explicit overall judgement.
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
import { setupProjectWithStudy, addOutcome, markChecklistComplete } from './shared-steps';

let scenario: DualReviewerScenario;

test.beforeAll(async () => {
  scenario = await seedDualReviewerScenario();
});

test.afterAll(async () => {
  if (scenario) await cleanupScenario(scenario);
});

/**
 * Fill a ROBINS-I checklist.
 *
 * ROBINS-I structure: Section B (screening) -> Domains (D1-D6) -> Overall.
 * Section B questions b2/b3 trigger "stop assessment" if answered Y/PY,
 * which hides all domain sections. We answer Section B with "N" first.
 */
async function fillROBINSIChecklist(page: import('@playwright/test').Page, domainAnswer: string) {
  // Step 1: Answer Section B questions with "N" to avoid stop assessment
  // Section B has 3 questions (b1, b2, b3) appearing before domain sections
  const nButtons = page.getByRole('button', { name: 'N', exact: true });
  const nCount = await nButtons.count();
  for (let i = 0; i < Math.min(nCount, 3); i++) {
    await nButtons.nth(i).scrollIntoViewIfNeeded();
    await nButtons.nth(i).click();
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(500);

  // Step 2: Answer all domain questions by navigating to each domain section
  // Use D1-D6 buttons to scroll to each domain, then click answer buttons within
  for (const domain of ['D1', 'D2', 'D3', 'D4', 'D5', 'D6']) {
    const domainBtn = page.getByRole('button', { name: domain, exact: true });
    if (await domainBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await domainBtn.click();
      await page.waitForTimeout(500);

      // Click all matching answer buttons currently visible
      const answerButtons = page.getByRole('button', { name: domainAnswer, exact: true });
      const count = await answerButtons.count();
      for (let i = 0; i < count; i++) {
        await answerButtons.nth(i).scrollIntoViewIfNeeded();
        await answerButtons.nth(i).click();
        await page.waitForTimeout(50);
      }
      await page.waitForTimeout(300);
    }
  }
  await page.waitForTimeout(1000);

  // Step 3: Set overall judgement -- scroll to bottom
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  // Click "Auto" in the Overall section (last Auto button on page)
  const autoBtn = page.getByRole('button', { name: 'Auto', exact: true }).last();
  if (await autoBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await autoBtn.click();
    await page.waitForTimeout(500);
  }
}

test('Dual-Reviewer ROBINS-I Workflow', async ({ context, page }) => {
  const projectId = await setupProjectWithStudy(context, page, scenario, 'ROBINS-I E2E Test');

  // Add an outcome (required for ROBINS-I)
  await addOutcome(page, 'Mortality');

  // ================================================================
  // User A fills ROBINS-I checklist
  // ================================================================
  await page.getByRole('tab', { name: /To Do/i }).click();
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: /Select Checklist/i }).click();
  await page.getByText(/AMSTAR 2/i).click();
  await page.getByRole('option', { name: /ROBINS-I/i }).click();
  await page.getByText(/Select outcome/i).click();
  await page.getByRole('option', { name: /Mortality/i }).click();
  await page.getByRole('button', { name: /Add Checklist/i }).click();
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: /Open/i }).click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await page.waitForTimeout(2000);

  // Fill checklist -- User A answers "Y" to everything
  await fillROBINSIChecklist(page, 'Y');
  await markChecklistComplete(page);
  await page.goto(`/projects/${projectId}`);
  await page.waitForTimeout(2000);

  // ================================================================
  // User B fills ROBINS-I checklist
  // ================================================================
  await switchUser(context, scenario.cookiesB);
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('tab', { name: /To Do/i }).click();
  await expect(page.getByText(/Untitled Study|Xavier/i).first()).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: /Select Checklist/i }).click();
  await page.getByText(/AMSTAR 2/i).click();
  await page.getByRole('option', { name: /ROBINS-I/i }).click();
  await page.getByText(/Select outcome/i).click();
  await page.getByRole('option', { name: /Mortality/i }).click();
  await page.getByRole('button', { name: /Add Checklist/i }).click();
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: /Open/i }).last().click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await page.waitForTimeout(2000);

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

  // Fill checklist -- User B answers "N" to everything
  await fillROBINSIChecklist(page, 'N');
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

  // Verify ROBINS-I reconciliation loaded
  await expect(page.getByRole('heading', { name: /ROBINS-I.*Reconciliation/i })).toBeVisible();
});
