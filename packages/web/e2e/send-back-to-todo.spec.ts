/**
 * E2E Test: Send an appraisal group back to the To-Do phase
 *
 * Covers both entry points on the Reconcile tab -- a group still waiting on the
 * second reviewer, and a ready pair whose reconciliation has already started
 * (where the consensus checklist is discarded) -- plus the guard that bounces a
 * reviewer who is sitting on the reconciliation screen when it happens.
 *
 * Prerequisites:
 *   pnpm --filter web dev  (localhost:3010, DEV_MODE=true)
 */

import { test, expect, type Page } from '@playwright/test';
import {
  seedDualReviewerScenario,
  cleanupScenario,
  switchUser,
  loginAs,
  type DualReviewerScenario,
} from './helpers';
import { setupProjectWithStudy, markChecklistComplete, answerAllAMSTAR2 } from './shared-steps';
import { BASE_URL } from './constants';

let scenario: DualReviewerScenario;

test.beforeAll(async () => {
  scenario = await seedDualReviewerScenario();
});

test.afterAll(async () => {
  if (scenario) await cleanupScenario(scenario);
});

/** Add an AMSTAR2 checklist, answer every question, and mark it complete. */
async function addAndCompleteChecklist(page: Page, projectId: string, answer: 'Yes' | 'No') {
  await page.getByRole('tab', { name: /To Do/i }).click();
  await expect(page.getByRole('button', { name: /Select appraisal tool/i })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole('button', { name: /Select appraisal tool/i }).click();
  await page.getByRole('button', { name: /Add appraisal/i }).click();
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole('button', { name: 'Open', exact: true }).last().click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });

  // Another reviewer's checklist may sort first; fall back to the other row.
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

  await answerAllAMSTAR2(page, answer);
  await markChecklistComplete(page);
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole('tab', { name: /To Do/i })).toBeVisible({ timeout: 15_000 });
}

/** Click Send back to To-Do on the first reconcile row and confirm the dialog. */
async function sendBackFirstGroup(page: Page, expectsConsensusWarning: boolean) {
  await page.getByRole('button', { name: 'Send back to To-Do', exact: true }).first().click();

  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByText('Send this appraisal back to To-Do?')).toBeVisible({
    timeout: 5_000,
  });
  if (expectsConsensusWarning) {
    await expect(dialog.getByText(/consensus appraisal/i)).toBeVisible();
  } else {
    await expect(dialog.getByText(/consensus appraisal/i)).toBeHidden();
  }

  await dialog.getByRole('button', { name: 'Send back to To-Do', exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

const RECONCILE_EMPTY_STATE = /A study appears here once both of its reviewers/i;

test('Send appraisals back to To-Do from the Reconcile tab', async ({ browser, context, page }) => {
  const projectId = await setupProjectWithStudy(context, page, scenario, 'Send Back E2E');

  // ================================================================
  // Waiting group: one reviewer done, no reconciliation started
  // ================================================================
  await addAndCompleteChecklist(page, projectId, 'Yes');

  await page.getByRole('tab', { name: /Reconcile/i }).click();
  await expect(page.getByText(/Waiting for/i)).toBeVisible({ timeout: 10_000 });

  await sendBackFirstGroup(page, false);

  await expect(page.getByText(RECONCILE_EMPTY_STATE)).toBeVisible({ timeout: 10_000 });

  // The checklist is editable again rather than locked
  await page.getByRole('tab', { name: /To Do/i }).click();
  await page.getByRole('button', { name: 'Open', exact: true }).first().click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: /Mark Complete/i })).toBeVisible({
    timeout: 10_000,
  });

  // Re-complete it so the pair can become ready
  await markChecklistComplete(page);
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole('tab', { name: /To Do/i })).toBeVisible({ timeout: 15_000 });

  // ================================================================
  // Ready pair: second reviewer completes, then opens reconciliation
  // ================================================================
  await switchUser(context, scenario.cookiesB);
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByText('Send Back E2E').first()).toBeVisible({ timeout: 15_000 });

  await addAndCompleteChecklist(page, projectId, 'No');

  await page.getByRole('tab', { name: /Reconcile/i }).click();
  await expect(page.getByText('Ready')).toBeVisible({ timeout: 10_000 });

  // Opening the screen creates the consensus checklist; user B stays on it
  await page.getByRole('button', { name: /^Reconcile$/ }).click();
  await expect(page).toHaveURL(/\/reconcile\//, { timeout: 10_000 });
  await expect(page.getByText('Setting up this reconciliation...')).toBeHidden({
    timeout: 20_000,
  });

  // ================================================================
  // User A sends the group back while user B watches the reconciliation
  // ================================================================
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await loginAs(contextA, scenario.cookiesA);

  try {
    // Land on the dashboard first so the fresh context resolves its active org
    // before hitting a project-scoped route.
    await pageA.goto(`${BASE_URL}/dashboard`);
    await expect(pageA.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });

    await pageA.goto(`${BASE_URL}/projects/${projectId}`);
    await pageA.getByRole('tab', { name: /Reconcile/i }).click();
    await expect(pageA.getByText('Ready')).toBeVisible({ timeout: 15_000 });

    await sendBackFirstGroup(pageA, true);

    await expect(pageA.getByText(RECONCILE_EMPTY_STATE)).toBeVisible({ timeout: 10_000 });

    // User B is pushed off the now-meaningless reconciliation screen
    await expect(page).toHaveURL(/\/projects\/[^/]+\?tab=todo/, { timeout: 20_000 });
    await expect(page.getByText('Reconciliation Cancelled')).toBeVisible({ timeout: 10_000 });

    // Both reviewers have the appraisal back, and nothing was finalized
    await expect(page.getByRole('button', { name: 'Open', exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });

    await pageA.getByRole('tab', { name: /To Do/i }).click();
    await expect(pageA.getByRole('button', { name: 'Open', exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });

    await pageA.getByRole('tab', { name: /Completed/i }).click();
    await expect(
      pageA.getByText(/Studies that have completed reconciliation appear here/i),
    ).toBeVisible({
      timeout: 10_000,
    });
  } finally {
    await contextA.close();
  }
});
