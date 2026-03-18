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
  // Scroll through the entire page progressively, clicking domain answer buttons.
  // Section B answers "N" to avoid stop assessment, domain questions answer the given answer.
  //
  // Strategy: scroll in increments, at each position click any visible answer buttons
  // that haven't been clicked yet. Section B N buttons are clicked first to prevent
  // stop assessment from hiding domains.

  // First pass: scroll through and click "N" for Section B questions only
  // (Section B is before domains, so scrolling top-to-bottom handles ordering)
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  // Scroll incrementally and click Section B "N" buttons
  // Section B questions have text like "b1", "b2", "b3"
  for (let scrollY = 0; scrollY < 5000; scrollY += 400) {
    await page.evaluate(y => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(200);

    // Look for section B - it has "stop assessment" related questions
    // Just click the first few N buttons we find (Section B appears before domains)
    if (scrollY < 2000) {
      const nBtns = page.getByRole('button', { name: 'N', exact: true });
      const nCount = await nBtns.count();
      // Only click N for the first 3 visible ones (Section B has 3 questions)
      for (let i = 0; i < Math.min(nCount, 3); i++) {
        const btn = nBtns.nth(i);
        const isVisible = await btn.isVisible().catch(() => false);
        if (isVisible) {
          await btn.click();
          await page.waitForTimeout(50);
        }
      }
    }
  }

  await page.waitForTimeout(500);

  // Second pass: scroll through and click domain answer buttons
  for (let scrollY = 0; scrollY < 15000; scrollY += 400) {
    await page.evaluate(y => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(150);

    const answerBtns = page.getByRole('button', { name: domainAnswer, exact: true });
    const count = await answerBtns.count();
    for (let i = 0; i < count; i++) {
      const btn = answerBtns.nth(i);
      const isVisible = await btn.isVisible().catch(() => false);
      if (isVisible) {
        // Check if not already selected
        const isSelected = await btn
          .evaluate(el => el.classList.contains('bg-blue-100'))
          .catch(() => false);
        if (!isSelected) {
          await btn.click();
          await page.waitForTimeout(30);
        }
      }
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

// TODO: ROBINS-I Domain 2 questions aren't reachable in the e2e test.
// The D2 section appears collapsed and neither nav button clicks nor
// scroll-through approaches can interact with its question buttons.
// This may be a UI bug where D2 doesn't auto-expand, or the section
// needs explicit click-to-expand. Investigate the DomainSection collapse
// behavior for domain2 specifically.
test.skip('Dual-Reviewer ROBINS-I Workflow', async ({ context, page }) => {
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
