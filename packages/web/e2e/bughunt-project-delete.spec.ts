/**
 * Bug hunt: project deletion while another member is working in it
 *
 * 1. Owner deletes the project from the dashboard while a second member is
 *    editing a checklist. The member should be told and redirected away,
 *    not left editing a dead document.
 * 2. After deletion, the member deep-linking back (warm local cache) must
 *    be denied, not shown stale cached project data indefinitely.
 *
 * Currently FAILS: the member stays on the checklist editor URL with no
 * notification. Same suspected root cause as bughunt-member-removal:
 * the ACCESS_DENIED error state is wiped by the synchronous RESET in
 * ConnectionPool.cleanupProjectLocalData before the redirect effect runs.
 *
 * Requires dev test server on localhost:3010 (DEV_MODE=true).
 */

import { test, expect } from '@playwright/test';
import { seedDualReviewerScenario, cleanupScenario, loginAs } from './helpers';
import { setupProjectWithStudy, answerAllAMSTAR2 } from './shared-steps';

test('Deleting a project ejects a member editing a checklist', async ({ browser }) => {
  const scenario = await seedDualReviewerScenario();
  try {
    const aliceCtx = await browser.newContext();
    const alicePage = await aliceCtx.newPage();
    const projectId = await setupProjectWithStudy(
      aliceCtx,
      alicePage,
      scenario,
      'Bughunt Delete Mid Edit',
    );

    // Bob opens the project and starts a checklist
    const bobCtx = await browser.newContext();
    const bobPage = await bobCtx.newPage();
    await loginAs(bobCtx, scenario.cookiesB);
    // Establish auth with a dashboard visit before deep-linking (fresh-context
    // auth pattern used by realtime-collaboration.spec.ts)
    await bobPage.goto('/dashboard');
    await expect(bobPage.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });
    await bobPage.goto(`/projects/${projectId}`);
    await expect(bobPage.getByRole('tab', { name: /To Do/i })).toBeVisible({ timeout: 15_000 });
    await bobPage.getByRole('tab', { name: /To Do/i }).click();
    await expect(bobPage.getByRole('button', { name: /Select Checklist/i })).toBeVisible({
      timeout: 10_000,
    });
    await bobPage.getByRole('button', { name: /Select Checklist/i }).click();
    await bobPage.getByRole('button', { name: /Add Checklist/i }).click();
    await expect(bobPage.getByRole('button', { name: 'Open', exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await bobPage.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(bobPage).toHaveURL(/\/checklists\//, { timeout: 10_000 });

    // Bob makes an edit so the doc is genuinely live
    await answerAllAMSTAR2(bobPage, 'Yes');

    // Alice deletes the project from her dashboard
    await alicePage.goto('/dashboard');
    await expect(alicePage.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });
    const deleteBtn = alicePage.getByRole('button', { name: 'Delete Project' }).first();
    await expect(deleteBtn).toBeVisible({ timeout: 10_000 });
    await deleteBtn.click();
    const dialog = alicePage.getByRole('alertdialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.getByRole('button', { name: /Delete/i }).click();
    await expect(alicePage.getByText('Project Deleted')).toBeVisible({ timeout: 15_000 });

    // Bob should be ejected from the checklist editor to the dashboard
    await expect(bobPage).toHaveURL(/\/dashboard/, { timeout: 20_000 });

    // Deep-linking back after deletion must also be denied
    await bobPage.goto(`/projects/${projectId}`);
    await expect(bobPage).toHaveURL(/\/dashboard/, { timeout: 30_000 });

    await bobCtx.close();
    await aliceCtx.close();
  } finally {
    await cleanupScenario(scenario);
  }
});
