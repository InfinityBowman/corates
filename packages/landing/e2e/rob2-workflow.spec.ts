/**
 * E2E Test: Dual-Reviewer ROB2 Workflow
 *
 * ROB2 requires outcomes and has a different question format (toggle buttons Y/PY/PN/N/NI).
 * Tests: create project with outcome, add study, both reviewers fill ROB2 checklists,
 * reach reconciliation view.
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

/** Fill the ROB2 preliminary section and select assessment aim */
async function fillROB2Preliminary(
  page: import('@playwright/test').Page,
  intervention: string,
  comparator: string,
) {
  await page.getByText('Individually-randomized parallel-group trial').click();
  await page.getByPlaceholder(/experimental intervention/i).fill(intervention);
  await page.getByPlaceholder(/comparator intervention/i).fill(comparator);
  await page.getByPlaceholder(/e\.g\. RR/i).fill('RR = 1.5 (95% CI 0.9 to 2.5)');

  const aimBtn = page.getByText('to assess the effect of assignment to intervention');
  await aimBtn.scrollIntoViewIfNeeded();
  await aimBtn.click();
  await page.waitForTimeout(1000);
}

/** Answer all ROB2 domain questions with a given response (Y or N) */
async function answerAllROB2Domains(page: import('@playwright/test').Page, answer: string) {
  for (const domain of ['D1', 'D2', 'D3', 'D4', 'D5']) {
    await page.getByRole('button', { name: domain, exact: true }).click();
    await page.waitForTimeout(500);

    const buttons = page.getByRole('button', { name: answer, exact: true });
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      await buttons.nth(i).scrollIntoViewIfNeeded();
      await buttons.nth(i).click();
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(300);
  }
}

test('Dual-Reviewer ROB2 Workflow', async ({ context, page }) => {
  const projectId = await setupProjectWithStudy(context, page, scenario, 'ROB2 E2E Test');

  // Add an outcome (required for ROB2)
  await addOutcome(page, 'Pain reduction');

  // ================================================================
  // User A fills ROB2 checklist
  // ================================================================
  await page.getByRole('tab', { name: /To Do/i }).click();
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: /Select Checklist/i }).click();
  await page.getByText(/AMSTAR 2/i).click();
  await page.getByRole('option', { name: /RoB 2/i }).click();
  await page.getByText(/Select outcome/i).click();
  await page.getByRole('option', { name: /Pain reduction/i }).click();
  await page.getByRole('button', { name: /Add Checklist/i }).click();
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await page.waitForTimeout(2000);

  await fillROB2Preliminary(page, 'Drug X', 'Placebo');
  await answerAllROB2Domains(page, 'Y');
  await page.waitForTimeout(1000);
  await markChecklistComplete(page);
  await page.goto(`/projects/${projectId}`);
  await page.waitForTimeout(2000);

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
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: 'Open', exact: true }).last().click();
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
    await page.getByRole('button', { name: 'Open', exact: true }).first().click();
    await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
    await page.waitForTimeout(2000);
  }

  await fillROB2Preliminary(page, 'Drug Y', 'Standard care');
  await answerAllROB2Domains(page, 'N');
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
      await page.waitForTimeout(500);
    }

    // For direction pages where reviewers didn't set a value, "Use This"
    // copies null which doesn't count as answered. Pick "NA" in the Final
    // Direction panel if a direction radio labeled "NA" is visible and
    // not already selected.
    const naLabel = page.locator('label').filter({ hasText: /^NA$/ });
    if (
      await naLabel
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      // Only click if we're on a direction page (Final Direction panel)
      const finalDirectionHeading = page.getByText('Final Direction');
      if (await finalDirectionHeading.isVisible().catch(() => false)) {
        await naLabel.first().click();
        await page.waitForTimeout(300);
      }
    }

    // Check if the Next button says "Review Summary" (last page)
    const btnText = await nextBtn.textContent();
    await nextBtn.click();
    await page.waitForTimeout(500);

    if (btnText?.includes('Review Summary')) break;
  }

  // ================================================================
  // Summary view - fix any remaining unanswered items
  // ================================================================
  await expect(page.getByText('Reconciliation Summary')).toBeVisible({ timeout: 5_000 });

  // Some preliminary text fields (Y.Text) may show "Not set" because the
  // observer didn't fire before navigating away. Click into each one from
  // the summary, click "Use This", wait for propagation, then return.
  let fixAttempts = 0;
  while (fixAttempts < 10) {
    const notSetItem = page.getByText('Not set').first();
    if (!(await notSetItem.isVisible().catch(() => false))) break;
    fixAttempts++;

    // Click the row to navigate to that item
    await notSetItem.click();
    await page.waitForTimeout(800);

    // Click "Use This" if available
    const useThisBtn = page.getByRole('button', { name: 'Use This' }).first();
    if (await useThisBtn.isVisible().catch(() => false)) {
      await useThisBtn.click();
      await page.waitForTimeout(800);
    }

    // For sources: if no sources were set by reviewers, check at least one
    const sourceCheckbox = page.locator('label').filter({ hasText: 'Journal article(s)' });
    if (await sourceCheckbox.isVisible().catch(() => false)) {
      await sourceCheckbox.click();
      await page.waitForTimeout(300);
    }

    // Go back to summary
    const summaryBtn = page.getByRole('button', { name: /Summary/i }).first();
    await summaryBtn.click();
    await page.waitForTimeout(500);
  }

  // All items should be reconciled
  const saveBtn = page.getByRole('button', { name: /Save Reconciled Checklist/i });
  await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
  await saveBtn.click();
  await page.waitForTimeout(500);

  // Confirm save in the dialog
  const finishBtn = page.getByRole('button', { name: 'Finish' });
  await expect(finishBtn).toBeVisible({ timeout: 3_000 });
  await finishBtn.click();

  // Should navigate back to the project page
  await expect(page).toHaveURL(/\/projects\//, { timeout: 10_000 });
  await page.waitForTimeout(1000);

  // Verify the completed tab shows the reconciled checklist
  await page.getByRole('tab', { name: /Completed/i }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText(/Reconciled/i).first()).toBeVisible({ timeout: 5_000 });
});
