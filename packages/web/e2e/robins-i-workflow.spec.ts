/**
 * E2E Test: Dual-Reviewer ROBINS-I Workflow
 *
 * ROBINS-I requires an outcome, uses toggle buttons (Y/PY/PN/N/NI) for domain
 * signalling questions, radio labels for Section B screening, has domain sections
 * (D1-D6), and derives the overall judgement automatically once all domains are
 * answered. Tests: both reviewers fill ROBINS-I checklists, then reconcile and save.
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
  answerROBINSISectionB,
  answerAllROBINSIDomains,
} from './shared-steps';

let scenario: DualReviewerScenario;

test.beforeAll(async () => {
  scenario = await seedDualReviewerScenario();
});

test.afterAll(async () => {
  if (scenario) await cleanupScenario(scenario);
});

/** Add a ROBINS-I checklist for the given outcome via the To Do tab picker. */
async function addROBINSIChecklist(page: import('@playwright/test').Page, outcome: string) {
  await page.getByRole('button', { name: /Select Checklist/i }).click();
  await page.getByText(/AMSTAR 2/i).click();
  await page.getByRole('option', { name: /ROBINS-I/i }).click();
  await page.getByText(/Select outcome/i).click();
  await page.getByRole('option', { name: new RegExp(outcome, 'i') }).click();
  await page.getByRole('button', { name: /Add Checklist/i }).click();
}

test('Dual-Reviewer ROBINS-I Workflow', async ({ context, page }) => {
  const projectId = await setupProjectWithStudy(context, page, scenario, 'ROBINS-I E2E Test');

  // ROBINS-I requires an outcome to assess.
  await addOutcome(page, 'Mortality');

  // ================================================================
  // User A fills ROBINS-I checklist (Yes-leaning answers)
  // ================================================================
  await page.getByRole('tab', { name: /To Do/i }).click();
  await expect(page.getByRole('button', { name: /Select Checklist/i })).toBeVisible({
    timeout: 10_000,
  });

  await addROBINSIChecklist(page, 'Mortality');
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await expect(page.getByText(/Section B: Decide Whether to Proceed/i)).toBeVisible({
    timeout: 10_000,
  });

  await answerROBINSISectionB(page, 'N');
  await answerAllROBINSIDomains(page, 'A');
  await markChecklistComplete(page);
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole('tab', { name: /To Do/i })).toBeVisible({ timeout: 15_000 });

  // ================================================================
  // User B fills ROBINS-I checklist (opposite answers for reconciliation)
  // ================================================================
  await switchUser(context, scenario.cookiesB);
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('tab', { name: /To Do/i }).click();
  await expect(page.getByRole('button', { name: /Select Checklist/i })).toBeVisible({
    timeout: 30_000,
  });

  await addROBINSIChecklist(page, 'Mortality');
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole('button', { name: 'Open', exact: true }).last().click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });

  // If the last "Open" landed on User A's read-only checklist, back out and open ours.
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

  await expect(page.getByText(/Section B: Decide Whether to Proceed/i)).toBeVisible({
    timeout: 10_000,
  });

  await answerROBINSISectionB(page, 'N');
  await answerAllROBINSIDomains(page, 'B');
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

  await expect(page.getByRole('heading', { name: /ROBINS-I Reconciliation/i })).toBeVisible();
  await expect(page.getByText('Item 1 of')).toBeVisible();

  // ================================================================
  // Walk every reconciliation page, then advance until the summary.
  // Judgements are auto-derived (not reconciled); only signalling questions need a
  // final answer, taken from Reviewer 1 via "Use This". Direction is optional.
  // ================================================================
  const nextBtn = page.getByRole('button', { name: /Next|Review Summary/i });

  let safety = 0;
  while (safety < 100) {
    safety++;

    const useThisBtn = page.getByRole('button', { name: 'Use This' }).first();
    if (await useThisBtn.isVisible().catch(() => false)) {
      await useThisBtn.click();
    }

    const btnText = await nextBtn.textContent();
    await nextBtn.click();

    if (btnText?.includes('Review Summary')) break;
  }

  // ================================================================
  // Summary view - verify and save
  // ================================================================
  await expect(page.getByText('Review Summary')).toBeVisible({ timeout: 5_000 });
  const saveBtn = page.getByRole('button', { name: /Save Reconciled Checklist/i });
  await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
  await saveBtn.click();

  // Confirm save in the dialog.
  const finishBtn = page.getByRole('button', { name: 'Finish' });
  await expect(finishBtn).toBeVisible({ timeout: 5_000 });
  await finishBtn.click();

  // Should navigate back to the project page.
  await expect(page).toHaveURL(/\/projects\//, { timeout: 10_000 });

  // Verify the completed tab shows the reconciled checklist.
  await page.getByRole('tab', { name: /Completed/i }).click();
  await expect(page.getByText(/Finalized/i).first()).toBeVisible({ timeout: 10_000 });
});
