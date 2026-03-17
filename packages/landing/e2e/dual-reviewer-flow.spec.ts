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
  addProjectMember,
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

  await page.getByRole('button', { name: /Create First Project/i }).click();
  await expect(page.getByText('Create a new project')).toBeVisible();
  await page.getByPlaceholder('My Systematic Review').fill('E2E Test Review');
  await page.getByPlaceholder('What is this review about?').fill('Dual-reviewer workflow test');
  await page.getByRole('button', { name: 'Create Project' }).click();
  await expect(page).toHaveURL(/\/projects\//, { timeout: 15_000 });

  // Capture projectId from URL and add Bob as a project member
  const projectId = page.url().match(/\/projects\/([^/?]+)/)?.[1];
  if (!projectId) throw new Error('Could not extract projectId from URL');
  await addProjectMember(scenario.orgId, projectId, scenario.userB.id, scenario.cookiesA);

  await page.waitForTimeout(2000);

  // ================================================================
  // Phase 2: User A adds a study via PMID lookup
  // ================================================================
  await page.getByRole('tab', { name: /All Studies/i }).click();
  await page.getByText('Add Studies to Your Project').click();
  await page.getByText('DOI / PMID').click();

  const doiInput = page.getByPlaceholder(/10\.1000/);
  await doiInput.fill('32615397');
  await page.getByRole('button', { name: /Look Up/i }).click();

  // Wait for external PMID lookup API
  await expect(page.getByText(/Found references/)).toBeVisible({ timeout: 15_000 });

  // Click "Add 1 Study" button
  await page.getByRole('button', { name: /Add \d+ Stud/i }).click();

  // Verify study appeared in the list
  await expect(page.getByText(/1 study in this project/i)).toBeVisible({ timeout: 10_000 });

  // ================================================================
  // Phase 3: User A assigns reviewers
  // ================================================================
  // Click the three-dots menu on the study card, then "Assign Reviewers"
  await page.locator('button:has(svg.lucide-ellipsis-vertical)').first().click();
  await page.getByRole('menuitem', { name: /Assign Reviewers/i }).click();

  // Modal should appear
  await expect(page.getByRole('heading', { name: 'Assign Reviewers' })).toBeVisible({
    timeout: 5_000,
  });

  // Select User A as Reviewer 1, User B as Reviewer 2
  // The dialog has two Select triggers labeled "Reviewer 1" and "Reviewer 2"
  const dialog = page.getByRole('dialog');

  // Click Reviewer 1 dropdown and select Alice
  await dialog.getByText('Unassigned').first().click();
  await page.getByRole('option', { name: /Alice/i }).click();

  // Click Reviewer 2 dropdown and select Bob
  await dialog.getByText('Unassigned').first().click();
  await page.getByRole('option', { name: /Bob/i }).click();

  // Save
  await dialog.getByRole('button', { name: 'Save' }).click();

  // Modal should close
  await expect(dialog).toBeHidden({ timeout: 5_000 });

  // ================================================================
  // Phase 4: User A creates and fills AMSTAR2 checklist
  // ================================================================
  await page.getByRole('tab', { name: /To Do/i }).click();
  await page.waitForTimeout(1000);

  // Click "Select Checklist" to open the checklist type form
  await page.getByRole('button', { name: /Select Checklist/i }).click();

  // AMSTAR2 is pre-selected, click "Add Checklist"
  await page.getByRole('button', { name: /Add Checklist/i }).click();
  await page.waitForTimeout(1000);

  // The checklist should now appear with an "Open" button
  await page.getByRole('button', { name: /Open/i }).click();

  // Should navigate to the checklist page
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await page.waitForTimeout(2000);

  // Fill all AMSTAR2 questions -- User A answers "Yes" to everything
  // Click every "Yes" radio button on the page
  const yesRadios = page.getByRole('radio', { name: 'Yes' });
  const count = await yesRadios.count();
  for (let i = 0; i < count; i++) {
    await yesRadios.nth(i).click();
  }
  await page.waitForTimeout(1000);

  // Mark as complete
  await page.getByRole('button', { name: /Mark Complete/i }).click();

  // Confirm dialog
  await page.waitForTimeout(500);
  const confirmBtn = page.getByRole('button', { name: /Confirm|Complete|Submit/i }).last();
  if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await confirmBtn.click();
  }
  await page.waitForTimeout(2000);

  // Navigate back to the project
  await page.goto(`/projects/${projectId}`);
  await page.waitForTimeout(2000);

  // ================================================================
  // Phase 5: Switch to User B, fill their checklist
  // ================================================================
  await switchUser(context, scenario.cookiesB);
  await page.goto(`/projects/${projectId}`);
  await page.waitForTimeout(3000);

  // Go to Todo tab
  await page.getByRole('tab', { name: /To Do/i }).click();
  await page.waitForTimeout(1000);

  // User B creates their checklist
  await page.getByRole('button', { name: /Select Checklist/i }).click();
  await page.getByRole('button', { name: /Add Checklist/i }).click();
  await page.waitForTimeout(1000);

  // There may now be two checklists (User A's completed + User B's new one)
  // The "Open" button for User B's checklist should be the one that's not read-only
  // Click the last "Open" button (most recently created)
  await page.getByRole('button', { name: /Open/i }).last().click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await page.waitForTimeout(2000);

  // Verify this is not read-only (User B's own checklist)
  const isReadOnly = await page
    .getByText('Read-only')
    .isVisible()
    .catch(() => false);
  if (isReadOnly) {
    // Wrong checklist -- go back and try the other one
    await page.goBack();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /Open/i }).first().click();
    await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
    await page.waitForTimeout(2000);
  }

  // User B answers "No" to everything (different from User A)
  const noRadios = page.getByRole('radio', { name: 'No' });
  const noCount = await noRadios.count();
  for (let i = 0; i < noCount; i++) {
    await noRadios.nth(i).click();
  }
  await page.waitForTimeout(1000);

  // Mark as complete
  await page.getByRole('button', { name: /Mark Complete/i }).click();
  await page.waitForTimeout(500);
  const confirmBtn2 = page.getByRole('button', { name: /Confirm|Complete|Submit/i }).last();
  if (await confirmBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await confirmBtn2.click();
  }
  await page.waitForTimeout(2000);

  // Navigate back to project
  await page.goto(`/projects/${projectId}`);
  await page.waitForTimeout(2000);

  // ================================================================
  // Phase 6: Reconciliation
  // ================================================================
  await page.getByRole('tab', { name: /Reconcile/i }).click();
  await page.waitForTimeout(2000);

  // Verify reconcile tab shows the study ready for reconciliation
  await expect(page.getByText('Ready')).toBeVisible({ timeout: 5_000 });

  // Click Reconcile
  await page.getByRole('button', { name: /Reconcile/i }).click();

  // Should navigate to reconciliation view
  await expect(page).toHaveURL(/\/reconcile\//, { timeout: 10_000 });
  await page.waitForTimeout(2000);

  // Verify reconciliation view loaded
  await expect(page.getByRole('heading', { name: 'Reconciliation' })).toBeVisible();
  await expect(page.getByText('Question 1 of 16')).toBeVisible();

  // For each of the 16 questions, click "Use This" on Alice's answer (first one)
  // then click "Next" to advance
  for (let q = 1; q <= 16; q++) {
    await expect(page.getByText(`Question ${q} of 16`)).toBeVisible({ timeout: 5_000 });

    // Click the first "Use This" button (Alice's answer)
    await page.getByRole('button', { name: 'Use This' }).first().click();
    await page.waitForTimeout(300);

    // Click Next (except on the last question)
    if (q < 16) {
      await page.getByRole('button', { name: /Next/i }).click();
      await page.waitForTimeout(300);
    }
  }

  // After all 16 questions, click "Review Summary" to see the summary
  await page.getByRole('button', { name: 'Review Summary' }).click();
  await page.waitForTimeout(1000);

  // Verify summary loaded
  await expect(page.getByText('Review Summary')).toBeVisible();
  await expect(page.getByText('Total Questions')).toBeVisible();

  // Scroll down and click "Save Reconciled Checklist"
  const saveBtn = page.getByRole('button', { name: /Save Reconciled Checklist/i });
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();

  // Confirm the "Finish reconciliation?" dialog
  await expect(page.getByText('Finish reconciliation?')).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: 'Finish' }).click();

  await page.waitForTimeout(3000);

  // ================================================================
  // Phase 7: Verify completed checklist
  // ================================================================
  // Navigate back to the project
  await page.goto(`/projects/${projectId}`);
  await page.waitForTimeout(2000);

  // Click the Completed tab
  await page.getByRole('tab', { name: /Completed/i }).click();
  await page.waitForTimeout(1000);

  // The study should appear in the completed list with a finalized checklist
  await expect(page.getByText('Untitled Study')).toBeVisible({ timeout: 5_000 });
});

test('Dual-Reviewer ROB2 Workflow', async ({ context, page }) => {
  // ================================================================
  // Phase 1: User A creates a project with an outcome
  // ================================================================
  await loginAs(context, scenario.cookiesA);
  await page.goto('/dashboard');
  await expect(page.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });

  // Create project (use header button to avoid strict mode with project section button)
  await page.locator('header').getByRole('button', { name: /New Project/i }).click();
  await expect(page.getByText('Create a new project')).toBeVisible();
  await page.getByPlaceholder('My Systematic Review').fill('ROB2 E2E Test');
  await page.getByRole('button', { name: 'Create Project' }).click();
  await expect(page).toHaveURL(/\/projects\//, { timeout: 15_000 });

  const projectId = page.url().match(/\/projects\/([^/?]+)/)?.[1];
  if (!projectId) throw new Error('Could not extract projectId from URL');
  await addProjectMember(scenario.orgId, projectId, scenario.userB.id, scenario.cookiesA);
  await page.waitForTimeout(2000);

  // ================================================================
  // Phase 2: Add an outcome
  // ================================================================
  await page.getByRole('tab', { name: /All Studies/i }).click();

  // Expand the Outcomes section and add an outcome
  await page.getByText('Outcomes').click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Add/i }).last().click();

  // Fill the outcome name input and save
  await page.getByPlaceholder(/outcome/i).fill('Pain reduction');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  // ================================================================
  // Phase 3: Add a study
  // ================================================================
  await page.getByText('Add Studies to Your Project').click();
  await page.getByText('DOI / PMID').click();
  const doiInput = page.getByPlaceholder(/10\.1000/);
  await doiInput.fill('32615397');
  await page.getByRole('button', { name: /Look Up/i }).click();
  await expect(page.getByText(/Found references/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /Add \d+ Stud/i }).click();
  await expect(page.getByText(/1 study in this project/i)).toBeVisible({ timeout: 10_000 });

  // ================================================================
  // Phase 4: Assign reviewers
  // ================================================================
  await page.locator('button:has(svg.lucide-ellipsis-vertical)').first().click();
  await page.getByRole('menuitem', { name: /Assign Reviewers/i }).click();
  await expect(page.getByRole('heading', { name: 'Assign Reviewers' })).toBeVisible({
    timeout: 5_000,
  });

  const dialog = page.getByRole('dialog');
  await dialog.getByText('Unassigned').first().click();
  await page.getByRole('option', { name: /Alice/i }).click();
  await dialog.getByText('Unassigned').first().click();
  await page.getByRole('option', { name: /Bob/i }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden({ timeout: 5_000 });

  // ================================================================
  // Phase 5: User A creates ROB2 checklist with outcome
  // ================================================================
  await page.getByRole('tab', { name: /To Do/i }).click();
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: /Select Checklist/i }).click();

  // Change checklist type to ROB2
  await page.getByText(/AMSTAR 2/i).click();
  await page.getByRole('option', { name: /RoB 2/i }).click();

  // Select the outcome
  await page.getByText(/Select outcome/i).click();
  await page.getByRole('option', { name: /Pain reduction/i }).click();

  await page.getByRole('button', { name: /Add Checklist/i }).click();
  await page.waitForTimeout(1000);

  // Open the checklist
  await page.getByRole('button', { name: /Open/i }).click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await page.waitForTimeout(2000);

  // ROB2: Fill preliminary section
  await page.getByText('Individually-randomized parallel-group trial').click();
  await page.getByPlaceholder(/experimental intervention/i).fill('Drug X');
  await page.getByPlaceholder(/comparator intervention/i).fill('Placebo');
  await page.getByPlaceholder(/e\.g\. RR/i).fill('RR = 1.5 (95% CI 0.9 to 2.5)');

  // Select the assessment aim (required for domain questions to appear)
  const aimBtn = page.getByText('to assess the effect of assignment to intervention');
  await aimBtn.scrollIntoViewIfNeeded();
  await aimBtn.click();
  await page.waitForTimeout(1000);

  // ROB2 domain questions use toggle buttons (not radio inputs)
  // Navigate each domain and click the "Y" button for each question
  for (const domain of ['D1', 'D2', 'D3', 'D4', 'D5']) {
    // Click domain nav button to scroll to that section
    await page.getByRole('button', { name: domain, exact: true }).click();
    await page.waitForTimeout(500);

    // Find all "Y" toggle buttons that are NOT already selected
    // ROB2 question buttons have text Y, PY, PN, N, NI
    const domainSection = page.locator(`text=Domain ${domain.replace('D', '')}`).first().locator('..');
    // Click all Y buttons on the page (they're unique per question row)
    const yButtons = page.getByRole('button', { name: 'Y', exact: true });
    const yCount = await yButtons.count();
    for (let i = 0; i < yCount; i++) {
      await yButtons.nth(i).scrollIntoViewIfNeeded();
      await yButtons.nth(i).click();
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1000);

  // Mark complete
  await page.getByRole('button', { name: /Mark Complete/i }).click();
  await page.waitForTimeout(500);
  const confirmBtn = page.getByRole('button', { name: /Mark Complete/i }).last();
  if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await confirmBtn.click();
  }
  await page.waitForTimeout(2000);
  await page.goto(`/projects/${projectId}`);
  await page.waitForTimeout(2000);

  // ================================================================
  // Phase 6: Switch to User B, fill ROB2 checklist
  // ================================================================
  await switchUser(context, scenario.cookiesB);
  await page.goto(`/projects/${projectId}`);
  await page.waitForTimeout(3000);

  await page.getByRole('tab', { name: /To Do/i }).click();
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: /Select Checklist/i }).click();

  // Select ROB2 type
  await page.getByText(/AMSTAR 2/i).click();
  await page.getByRole('option', { name: /RoB 2/i }).click();

  // Select the same outcome
  await page.getByText(/Select outcome/i).click();
  await page.getByRole('option', { name: /Pain reduction/i }).click();

  await page.getByRole('button', { name: /Add Checklist/i }).click();
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: /Open/i }).last().click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await page.waitForTimeout(2000);

  // Verify not read-only
  const isReadOnly = await page.getByText('Read-only').isVisible().catch(() => false);
  if (isReadOnly) {
    await page.goBack();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /Open/i }).first().click();
    await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
    await page.waitForTimeout(2000);
  }

  // Fill preliminary
  await page.getByText('Individually-randomized parallel-group trial').click();
  await page.getByPlaceholder(/experimental intervention/i).fill('Drug Y');
  await page.getByPlaceholder(/comparator intervention/i).fill('Standard care');
  await page.getByPlaceholder(/e\.g\. RR/i).fill('OR = 2.1 (95% CI 1.2 to 3.6)');

  // Select assessment aim
  const aimBtn2 = page.getByText('to assess the effect of assignment to intervention');
  await aimBtn2.scrollIntoViewIfNeeded();
  await aimBtn2.click();
  await page.waitForTimeout(1000);

  // Navigate domains and answer "N" for all questions
  for (const domain of ['D1', 'D2', 'D3', 'D4', 'D5']) {
    await page.getByRole('button', { name: domain, exact: true }).click();
    await page.waitForTimeout(500);

    const nButtons = page.getByRole('button', { name: 'N', exact: true });
    const nCount = await nButtons.count();
    for (let i = 0; i < nCount; i++) {
      await nButtons.nth(i).scrollIntoViewIfNeeded();
      await nButtons.nth(i).click();
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: /Mark Complete/i }).click();
  await page.waitForTimeout(500);
  const confirmBtn2 = page.getByRole('button', { name: /Mark Complete/i }).last();
  if (await confirmBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await confirmBtn2.click();
  }
  await page.waitForTimeout(2000);
  await page.goto(`/projects/${projectId}`);
  await page.waitForTimeout(2000);

  // ================================================================
  // Phase 7: Reconciliation
  // ================================================================
  await page.getByRole('tab', { name: /Reconcile/i }).click();
  await page.waitForTimeout(2000);
  await expect(page.getByText('Ready')).toBeVisible({ timeout: 5_000 });

  await page.getByRole('button', { name: /Reconcile/i }).click();
  await expect(page).toHaveURL(/\/reconcile\//, { timeout: 10_000 });
  await page.waitForTimeout(2000);

  // Debug: see what the ROB2 reconciliation looks like
  await page.screenshot({ path: 'e2e/debug-rob2-reconcile.png' });
});
