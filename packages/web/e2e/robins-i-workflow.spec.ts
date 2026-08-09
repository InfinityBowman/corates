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
  answerSignallingQuestion,
  setROBINSIDomainDirection,
} from './shared-steps';

/**
 * Answer Domain 6 so it early-exits for both reviewers: 6.1=Y forces Low, so
 * 6.2-6.4 become optional skips. Their scales have no NA option, so they stay
 * unanswered and must read as skipped (not missing) during reconciliation.
 */
async function answerROBINSIDomain6WithSkips(page: import('@playwright/test').Page) {
  await answerSignallingQuestion(page, 'domain6', /pre-determined analysis plan/i, 'Y');
  // exact: the direction label renders its own lowercase "(optional)"
  await expect(
    page.locator('#domain-section-domain6').getByText('(Optional)', { exact: true }),
  ).toHaveCount(3, { timeout: 5_000 });
}

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
  const escapedOutcome = outcome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page.getByRole('option', { name: new RegExp(escapedOutcome, 'i') }).click();
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
  await answerAllROBINSIDomains(page, 'A', ['D1', 'D2', 'D3', 'D4', 'D5']);
  await answerROBINSIDomain6WithSkips(page);
  // Set a domain direction so reconciliation has a real direction to resolve.
  await setROBINSIDomainDirection(page, 'D2', 'domain2', 'Favours intervention');
  // Capture the editor: judgement is read-only ("Calculated"), direction is editable.
  await page
    .locator('#domain-section-domain2')
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await page.screenshot({ path: 'test-results/robins-editor-domain2.png' });
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
  await answerAllROBINSIDomains(page, 'B', ['D1', 'D2', 'D3', 'D4', 'D5']);
  await answerROBINSIDomain6WithSkips(page);
  // Different direction than Reviewer A -> a direction conflict to reconcile.
  await setROBINSIDomainDirection(page, 'D2', 'domain2', 'Favours comparator');
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
  let capturedDirectionPage = false;
  let sawSkippedQuestionPage = false;
  while (safety < 100) {
    safety++;

    // Capture a direction page (derived judgement read-only + direction panels).
    if (
      !capturedDirectionPage &&
      (await page
        .getByText('Auto-calculated Judgement')
        .first()
        .isVisible()
        .catch(() => false))
    ) {
      await page.screenshot({ path: 'test-results/robins-direction-page.png' });
      capturedDirectionPage = true;
    }

    // 6.2: skipped by both reviewers, and the reconciled 6.1=Y already
    // determines Domain 6 -- so both reviewer panels and the final panel
    // carry the Skipped badge and the page banner marks it not required.
    if (
      await page
        .getByRole('heading', { name: /multiple outcome measurements/i })
        .isVisible()
        .catch(() => false)
    ) {
      await expect(page.getByText('Skipped - Not applicable')).toHaveCount(3);
      await expect(page.getByText(/this question is not required/i)).toBeVisible();
      sawSkippedQuestionPage = true;
    }

    const useThisBtn = page.getByRole('button', { name: 'Use This' }).first();
    if (await useThisBtn.isVisible().catch(() => false)) {
      await useThisBtn.click();
    }

    const btnText = await nextBtn.textContent();
    await nextBtn.click();

    if (btnText?.includes('Review Summary')) break;
  }

  // The walk must have passed through the skipped Domain 6 question.
  expect(sawSkippedQuestionPage).toBe(true);

  // ================================================================
  // Summary view - verify and save
  // ================================================================
  await expect(page.getByText('Review Summary')).toBeVisible({ timeout: 5_000 });
  // The reconciled domain-2 direction resolves to one reviewer's value (not "Not set").
  await expect(page.getByText(/Favours (intervention|comparator)/).first()).toBeVisible({
    timeout: 5_000,
  });
  // Skipped Domain 6 questions surface as skipped rather than unanswered and
  // do not block saving.
  await expect(page.getByText('Skipped - Not applicable').first()).toBeVisible({ timeout: 5_000 });
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
