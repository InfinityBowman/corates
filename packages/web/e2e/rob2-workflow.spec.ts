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

import { test, expect } from './test';
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
  answerSignallingQuestion,
} from './shared-steps';

/**
 * Answer the domains so two skip states arise for both reviewers:
 * - Domain 1 early-exits at 1.2=N (forces High); 1.1 and 1.3 have no NA on
 *   the official scale, so they stay unanswered and read as skipped.
 * - Domain 3 early-exits at 3.1=Y (forces Low); 3.2-3.4 are WITH_NA
 *   conditionals that get stamped NA when the checklist is marked complete.
 * Remaining domains are answered in full with the reviewer's answer.
 */
async function answerROB2DomainsWithSkips(page: import('@playwright/test').Page, answer: string) {
  await answerSignallingQuestion(page, 'domain1', /allocation sequence concealed/i, 'N');
  // exact: the direction label renders its own lowercase "(optional)"
  await expect(
    page.locator('#domain-section-domain1').getByText('(Optional)', { exact: true }),
  ).toHaveCount(2, { timeout: 5_000 });

  await answerSignallingQuestion(
    page,
    'domain3',
    /available for all, or nearly all, participants randomized/i,
    'Y',
  );
  await expect(
    page.locator('#domain-section-domain3').getByText('(Optional)', { exact: true }),
  ).toHaveCount(3, { timeout: 5_000 });

  await answerAllROB2Domains(page, answer, ['domain2a', 'domain4', 'domain5']);
}

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
  await page.getByRole('tab', { name: /To-Do/i }).click();
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
  await answerROB2DomainsWithSkips(page, 'Y');
  await markChecklistComplete(page);
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole('tab', { name: /To-Do/i })).toBeVisible({ timeout: 15_000 });

  // ================================================================
  // User B fills ROB2 checklist
  // ================================================================
  await switchUser(context, scenario.cookiesB);
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('tab', { name: /To-Do/i }).click();
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
  await answerROB2DomainsWithSkips(page, 'N');
  await markChecklistComplete(page);
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole('tab', { name: /To-Do/i })).toBeVisible({ timeout: 15_000 });

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
  let sawSkippedReviewerPanels = false;
  let sawNotRequiredBanner = false;
  let sawStampedNA = false;
  while (safety < 80) {
    safety++;

    // 1.1: both reviewers derived-skipped it, so both panels carry the badge
    // and the page reads as agreement despite two null answers.
    if (
      await page
        .getByRole('heading', { name: /Was the allocation sequence random/i })
        .isVisible()
        .catch(() => false)
    ) {
      await expect(page.getByText('Skipped - Not applicable')).toHaveCount(2);
      sawSkippedReviewerPanels = true;
    }

    // 1.3: by now the reconciled 1.2=N determines Domain 1, so the page
    // banner marks the question as not required.
    if (
      await page
        .getByRole('heading', { name: /baseline differences/i })
        .isVisible()
        .catch(() => false)
    ) {
      await expect(page.getByText(/this question is not required/i)).toBeVisible();
      sawNotRequiredBanner = true;
    }

    // 3.2: WITH_NA conditional -- completion stamped the official NA into
    // both reviewers' records, so both panels show a selected NA.
    if (
      await page
        .getByRole('heading', { name: /not biased by missing outcome data/i })
        .isVisible()
        .catch(() => false)
    ) {
      await expect(page.getByText('NA - Not Applicable')).toHaveCount(2);
      sawStampedNA = true;
    }

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

  // The walk must have passed through all three skip states.
  expect(sawSkippedReviewerPanels).toBe(true);
  expect(sawNotRequiredBanner).toBe(true);
  expect(sawStampedNA).toBe(true);

  // ================================================================
  // Summary view - verify and save
  // ================================================================
  await expect(page.getByText('Reconciliation Summary')).toBeVisible({ timeout: 5_000 });
  await page.screenshot({ path: 'test-results/debug-summary.png' });
  // Skipped questions surface as "Skipped" rather than "Not set" and do not
  // block saving.
  await expect(page.getByText('Skipped', { exact: true }).first()).toBeVisible({ timeout: 5_000 });
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
