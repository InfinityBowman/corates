/**
 * E2E Test: Change Outcome for checklist appraisal groups
 *
 * Covers moving a study's checklist pair between outcomes from the Reconcile
 * tab (reviewer-completed pair) and from the Completed tab (finalized group,
 * where the consensus checklist and reconciliation history move along).
 *
 * Prerequisites:
 *   pnpm --filter web dev  (localhost:3010, DEV_MODE=true)
 */

import { test, expect, type Page } from '@playwright/test';
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

/** Add a ROB2 checklist for the given outcome, fill it, and mark it complete. */
async function fillROB2ChecklistForOutcome(
  page: Page,
  projectId: string,
  outcomeName: string,
  answer: string,
) {
  await page.getByRole('tab', { name: /To Do/i }).click();
  await expect(page.getByRole('button', { name: /Select Checklist/i })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole('button', { name: /Select Checklist/i }).click();
  await page.getByText(/AMSTAR 2/i).click();
  await page.getByRole('option', { name: /RoB 2/i }).click();
  await page.getByText(/Select outcome/i).click();
  await page.getByRole('option', { name: outcomeName }).click();
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
    await page.getByRole('button', { name: 'Open', exact: true }).first().click();
    await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  }

  await expect(page.getByText('Individually-randomized parallel-group trial')).toBeVisible({
    timeout: 10_000,
  });
  await fillROB2Preliminary(page, 'Drug X', 'Placebo');
  await answerAllROB2Domains(page, answer);
  await markChecklistComplete(page);
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole('tab', { name: /To Do/i })).toBeVisible({ timeout: 15_000 });
}

/** Change the outcome via the pencil button next to the outcome badge. */
async function changeOutcomeViaDialog(page: Page, targetOutcomeName: string) {
  await page.getByRole('button', { name: 'Change outcome', exact: true }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Change Outcome' })).toBeVisible({
    timeout: 5_000,
  });

  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: targetOutcomeName }).click();
  await dialog.getByRole('button', { name: 'Change Outcome' }).click();

  await expect(dialog).toBeHidden({ timeout: 5_000 });
}

test('Change outcome from Reconcile and Completed tabs', async ({ context, page }) => {
  const projectId = await setupProjectWithStudy(context, page, scenario, 'Outcome Move E2E');

  await addOutcome(page, 'Employment');
  await addOutcome(page, 'Credentialing');

  // Both reviewers complete ROB2 checklists under Employment
  await fillROB2ChecklistForOutcome(page, projectId, 'Employment', 'Y');

  await switchUser(context, scenario.cookiesB);
  await page.goto(`/projects/${projectId}`);
  await fillROB2ChecklistForOutcome(page, projectId, 'Employment', 'N');

  // ================================================================
  // Reconcile tab: ready pair shows under Employment; move it to
  // Credentialing before reconciling
  // ================================================================
  await page.getByRole('tab', { name: /Reconcile/i }).click();
  await expect(page.getByText('Employment')).toBeVisible({ timeout: 10_000 });

  await changeOutcomeViaDialog(page, 'Credentialing');

  await expect(page.getByText('Credentialing')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Employment')).toBeHidden();

  // The pair must still be reconcilable under the new outcome
  const reconcileBtn = page.getByRole('button', { name: /^Reconcile$/ });
  await expect(reconcileBtn).toBeEnabled();

  // ================================================================
  // Reconcile the pair and finalize
  // ================================================================
  await reconcileBtn.click();
  await expect(page).toHaveURL(/\/reconcile\//, { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: /ROB-2 Reconciliation/i })).toBeVisible();

  const nextBtn = page.getByRole('button', { name: /Next|Review Summary/i });
  let safety = 0;
  while (safety < 80) {
    safety++;

    const useThisBtn = page.getByRole('button', { name: 'Use This' }).first();
    if (await useThisBtn.isVisible().catch(() => false)) {
      await useThisBtn.click();
    }

    const sourceLabel = page.locator('label').filter({ hasText: 'Journal article(s)' });
    if (await sourceLabel.isVisible().catch(() => false)) {
      if (
        await page
          .getByText('Final Answer')
          .isVisible()
          .catch(() => false)
      ) {
        await sourceLabel.click();
      }
    }

    const btnText = await nextBtn.textContent();
    await nextBtn.click();
    if (btnText?.includes('Review Summary')) break;
  }

  await expect(page.getByText('Reconciliation Summary')).toBeVisible({ timeout: 5_000 });
  const saveBtn = page.getByRole('button', { name: /Save Reconciled Checklist/i });
  await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
  await saveBtn.click();
  const finishBtn = page.getByRole('button', { name: 'Finish' });
  await expect(finishBtn).toBeVisible({ timeout: 5_000 });
  await finishBtn.click();
  await expect(page).toHaveURL(/\/projects\//, { timeout: 10_000 });

  // ================================================================
  // Completed tab: finalized group moves back to Employment intact
  // ================================================================
  await page.getByRole('tab', { name: /Completed/i }).click();
  await expect(page.getByText(/Finalized/i).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Credentialing')).toBeVisible();

  await changeOutcomeViaDialog(page, 'Employment');

  await expect(page.getByText('Employment')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Credentialing')).toBeHidden();
  await expect(page.getByText(/Finalized/i).first()).toBeVisible();

  // Reconciliation history moved with the group: previous reviewer
  // checklists are still reachable under the new outcome key
  await expect(page.getByRole('button', { name: /View Previous/i })).toBeVisible();
});
