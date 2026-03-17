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
  await expect(page.getByRole('heading', { name: 'Assign Reviewers' })).toBeVisible({ timeout: 5_000 });

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

  // TODO(agent): Continue the workflow:
  // - Fill all 16 AMSTAR2 questions
  // - Mark checklist as complete
  // - Switch to User B
  // - User B fills their checklist
  // - Reconciliation
  // - Verify completed

  // For now, verify the checklist page loaded
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/debug-checklist-page.png' });
});
