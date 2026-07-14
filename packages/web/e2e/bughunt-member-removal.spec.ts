/**
 * Bug hunt: member removal cross-feature behavior
 *
 * 1. Removing a member while they have the project open should kick them
 *    out (redirect to dashboard with an Access Denied toast), not leave
 *    them stuck on a loading skeleton.
 * 2. A removed member deep-linking back to the project (with warm local
 *    cache) must not retain access; they should be redirected away.
 *
 * Both currently FAIL: the removed member is left on an infinite
 * "Syncing project..." skeleton at the project URL. Suspected cause:
 * connection.ts dispatches ACCESS_DENIED and then synchronously calls
 * onAccessDenied -> ConnectionPool.cleanupProjectLocalData -> destroyEntry,
 * which dispatches RESET in the same tick, wiping the error before
 * ProjectGate's redirect effect ever observes it.
 *
 * Requires dev test server on localhost:3010 (DEV_MODE=true).
 */

import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  seedDualReviewerScenario,
  cleanupScenario,
  loginAs,
  type DualReviewerScenario,
} from './helpers';
import { setupProjectWithStudy } from './shared-steps';

async function openAsBob(
  browser: Browser,
  scenario: DualReviewerScenario,
  projectId: string,
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAs(ctx, scenario.cookiesB);
  // Establish auth with a dashboard visit before deep-linking (fresh-context
  // auth pattern used by realtime-collaboration.spec.ts)
  await page.goto('/dashboard');
  await expect(page.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole('tab', { name: /All Studies/i })).toBeVisible({ timeout: 15_000 });
  return { ctx, page };
}

/** Remove Bob from the project via the Overview tab UI (as owner Alice). */
async function removeBobViaUI(alicePage: Page) {
  await alicePage.getByRole('tab', { name: /Overview/i }).click();
  const removeBtn = alicePage.getByRole('button', { name: 'Remove member' });
  await expect(removeBtn).toBeVisible({ timeout: 10_000 });
  await removeBtn.click();

  const dialog = alicePage.getByRole('alertdialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

test('Removing a member kicks their open project session', async ({ browser }) => {
  const scenario = await seedDualReviewerScenario();
  try {
    const aliceCtx = await browser.newContext();
    const alicePage = await aliceCtx.newPage();
    const projectId = await setupProjectWithStudy(
      aliceCtx,
      alicePage,
      scenario,
      'Bughunt Removal Live',
    );

    const { ctx: bobCtx, page: bobPage } = await openAsBob(browser, scenario, projectId);

    await removeBobViaUI(alicePage);

    // Bob's live session should be terminated and redirected to the dashboard
    await expect(bobPage).toHaveURL(/\/dashboard/, { timeout: 20_000 });

    await bobCtx.close();
    await aliceCtx.close();
  } finally {
    await cleanupScenario(scenario);
  }
});

test('Removed member deep-linking back to the project is denied', async ({ browser }) => {
  const scenario = await seedDualReviewerScenario();
  try {
    const aliceCtx = await browser.newContext();
    const alicePage = await aliceCtx.newPage();
    const projectId = await setupProjectWithStudy(
      aliceCtx,
      alicePage,
      scenario,
      'Bughunt Removal Deeplink',
    );

    // Bob opens the project first so his browser has warm local cache (Dexie)
    const { ctx: bobCtx, page: bobPage } = await openAsBob(browser, scenario, projectId);
    await bobPage.goto('/dashboard');
    await expect(bobPage.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });

    await removeBobViaUI(alicePage);

    // Bob deep-links back to the project. Local cache may flash, but he must
    // be denied and redirected away, not keep working in the project.
    await bobPage.goto(`/projects/${projectId}`);
    await expect(bobPage).toHaveURL(/\/dashboard/, { timeout: 30_000 });

    await bobCtx.close();
    await aliceCtx.close();
  } finally {
    await cleanupScenario(scenario);
  }
});

