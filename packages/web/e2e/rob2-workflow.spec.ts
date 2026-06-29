/**
 * E2E Test: Dual-Reviewer ROB2 Workflow
 *
 * ROB2 requires outcomes and has a different question format (toggle buttons Y/PY/PN/N/NI).
 * Tests: create project with outcome, add study, both reviewers fill ROB2 checklists,
 * reach reconciliation view.
 *
 * Prerequisites:
 *   pnpm --filter web dev  (localhost:3010, DEV_MODE=true)
 */

import { test, expect } from '@playwright/test';
import {
  seedDualReviewerScenario,
  cleanupScenario,
  switchUser,
  type DualReviewerScenario,
} from './helpers';
import {
  setupProjectWithStudy,
  addOutcome,
  markChecklistComplete,
  fillROB2Preliminary,
  answerAllROB2Domains,
} from './shared-steps';

let scenario: DualReviewerScenario;

test.beforeAll(async () => {
  scenario = await seedDualReviewerScenario();
});

test.afterAll(async () => {
  if (scenario) await cleanupScenario(scenario);
});

test('Dual-Reviewer ROB2 Workflow', async ({ context, page }) => {
  const projectId = await setupProjectWithStudy(context, page, scenario, 'ROB2 E2E Test');

  // Add an outcome (required for ROB2)
  await addOutcome(page, 'Pain reduction');

  // ================================================================
  // User A fills ROB2 checklist
  // ================================================================
  await page.getByRole('tab', { name: /To Do/i }).click();
  await expect(page.getByRole('button', { name: /Select Checklist/i })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole('button', { name: /Select Checklist/i }).click();
  await page.getByText(/AMSTAR 2/i).click();
  await page.getByRole('option', { name: /RoB 2/i }).click();
  await page.getByText(/Select outcome/i).click();
  await page.getByRole('option', { name: /Pain reduction/i }).click();
  await page.getByRole('button', { name: /Add Checklist/i }).click();
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await expect(page.getByText('Individually-randomized parallel-group trial')).toBeVisible({
    timeout: 10_000,
  });

  await fillROB2Preliminary(page, 'Drug X', 'Placebo');
  await answerAllROB2Domains(page, 'Y');
  await markChecklistComplete(page);
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole('tab', { name: /To Do/i })).toBeVisible({ timeout: 15_000 });

  // ================================================================
  // User B fills ROB2 checklist
  // ================================================================
  await switchUser(context, scenario.cookiesB);
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('tab', { name: /To Do/i }).click();
  await expect(page.getByText(/Petrie2019/i).first()).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: /Select Checklist/i }).click();
  await page.getByText(/AMSTAR 2/i).click();
  await page.getByRole('option', { name: /RoB 2/i }).click();
  await page.getByText(/Select outcome/i).click();
  await page.getByRole('option', { name: /Pain reduction/i }).click();
  await page.getByRole('button', { name: /Add Checklist/i }).click();
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole('button', { name: 'Open', exact: true }).last().click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });

  if (
    await page
      .getByText('Read-only')
      .isVisible()
      .catch(() => false)
  ) {
    await page.goBack();
    await expect(page.getByRole('button', { name: 'Open', exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: 'Open', exact: true }).first().click();
    await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  }

  await expect(page.getByText('Individually-randomized parallel-group trial')).toBeVisible({
    timeout: 10_000,
  });
  await fillROB2Preliminary(page, 'Drug Y', 'Standard care');
  await answerAllROB2Domains(page, 'N');
  await markChecklistComplete(page);
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole('tab', { name: /To Do/i })).toBeVisible({ timeout: 15_000 });

  // ================================================================
  // Reconciliation
  // ================================================================
  await page.getByRole('tab', { name: /Reconcile/i }).click();
  await expect(page.getByText('Ready')).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: /Reconcile/i }).click();
  await expect(page).toHaveURL(/\/reconcile\//, { timeout: 10_000 });

  // Verify ROB2 reconciliation loaded
  await expect(page.getByRole('heading', { name: /ROB-2 Reconciliation/i })).toBeVisible();
  await expect(page.getByText('Item 1 of')).toBeVisible();
  await expect(page.getByText('D1').first()).toBeVisible();
  await expect(page.getByText('D5').first()).toBeVisible();

  // ================================================================
  // Walk through reconciliation: for each page, try "Use This" first.
  // If no "Use This" is available (e.g., direction pages where both
  // reviewers left it blank), pick a value in the Final panel directly.
  // ================================================================
  const nextBtn = page.getByRole('button', { name: /Next|Review Summary/i });

  let safety = 0;
  while (safety < 80) {
    safety++;

    // Try clicking "Use This" (Reviewer 1's panel)
    const useThisBtn = page.getByRole('button', { name: 'Use This' }).first();
    const hasUseThis = await useThisBtn.isVisible().catch(() => false);

    if (hasUseThis) {
      await useThisBtn.click();
    }

    // Predicted direction of bias is optional and does not block save, so no
    // final direction needs to be picked when reviewers left it unset.

    // For sources page: neither reviewer selected sources, so check one
    const sourceLabel = page.locator('label').filter({ hasText: 'Journal article(s)' });
    if (await sourceLabel.isVisible().catch(() => false)) {
      const finalAnswerHeading = page.getByText('Final Answer');
      if (await finalAnswerHeading.isVisible().catch(() => false)) {
        await sourceLabel.click();
      }
    }

    // Check if the Next button says "Review Summary" (last page)
    const btnText = await nextBtn.textContent();
    await nextBtn.click();

    if (btnText?.includes('Review Summary')) break;
  }

  // ================================================================
  // Summary view - verify and save
  // ================================================================
  await expect(page.getByText('Reconciliation Summary')).toBeVisible({ timeout: 5_000 });
  await page.screenshot({ path: 'test-results/debug-summary.png' });
  const saveBtn = page.getByRole('button', { name: /Save Reconciled Checklist/i });
  await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
  await saveBtn.click();

  // Confirm save in the dialog
  const finishBtn = page.getByRole('button', { name: 'Finish' });
  await expect(finishBtn).toBeVisible({ timeout: 5_000 });
  await finishBtn.click();

  // Should navigate back to the project page
  await expect(page).toHaveURL(/\/projects\//, { timeout: 10_000 });

  // Verify the completed tab shows the reconciled checklist
  await page.getByRole('tab', { name: /Completed/i }).click();
  await expect(page.getByText(/Finalized/i).first()).toBeVisible({ timeout: 10_000 });
});
