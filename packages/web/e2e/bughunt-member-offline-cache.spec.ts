/**
 * Bug hunt: members have no working offline cache (bug #18).
 *
 * ConnectionPool.initializeConnection registers the Dexie write-back handler
 * only after the local doc load resolves, and the initial back-fill copies
 * Dexie -> ydoc only. For a MEMBER, the project's base state arrives over the
 * WebSocket and is applied to the in-memory doc before that handler exists,
 * so it is never persisted to IndexedDB. The cached render phase requires
 * persisted studies, so it never fires for members.
 *
 * Decision (2026-07-20): full member offline support is deferred. Instead the
 * gate must FAIL LOUDLY: a member who reloads while the sync server is
 * unreachable sees an explicit connection-trouble state with a retry action,
 * not an infinite "Syncing project..." skeleton.
 *
 * The fixme test below documents the deferred goal (render from cache like
 * the owner does) and becomes the target if member offline support lands.
 *
 * Requires dev test server on localhost:3010 (DEV_MODE=true).
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import {
  seedDualReviewerScenario,
  cleanupScenario,
  loginAs,
  type DualReviewerScenario,
} from './helpers';
import { setupProjectWithStudy } from './shared-steps';

test.setTimeout(240_000);

/** Browses the project as Bob (member) online, then reloads with the sync
 * server unreachable. Returns Bob's page, wedged mid-reload. */
async function memberReloadWhileUnreachable(
  context: BrowserContext,
  page: Page,
  bobCtx: BrowserContext,
  scenario: DualReviewerScenario,
  projectName: string,
): Promise<Page> {
  const projectId = await setupProjectWithStudy(context, page, scenario, projectName);

  const bobPage = await bobCtx.newPage();
  await loginAs(bobCtx, scenario.cookiesB);
  await bobPage.goto('/dashboard');
  await expect(bobPage.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });
  await bobPage.goto(`/projects/${projectId}`);
  await expect(bobPage.getByRole('tab', { name: /Reconcile/i })).toBeVisible({
    timeout: 20_000,
  });
  await bobPage.waitForTimeout(2_000);

  await bobPage.routeWebSocket(/\/api\/project-doc/, ws => {
    ws.close();
  });
  await bobPage.reload();
  return bobPage;
}

test('Member reload with sync server unreachable fails loudly with a retry action', async ({
  context,
  page,
  browser,
}) => {
  const scenario: DualReviewerScenario = await seedDualReviewerScenario();
  const bobCtx = await browser.newContext();
  try {
    const bobPage = await memberReloadWhileUnreachable(
      context,
      page,
      bobCtx,
      scenario,
      'Bughunt Member Failloud',
    );

    // The gate must not spin forever: within the stall timeout (15s) plus
    // slack, an explicit connection-trouble state with a retry action appears.
    await expect(bobPage.getByText('Connection trouble')).toBeVisible({ timeout: 25_000 });
    await expect(bobPage.getByRole('button', { name: 'Retry' })).toBeVisible();
  } finally {
    await bobCtx.close();
    await cleanupScenario(scenario);
  }
});

// Deferred: member offline support. The owner in this situation renders from
// cache in about a second; a member should too. Unskip when member base-state
// persistence lands (see ConnectionPool.initializeConnection).
test.fixme('Member reload with sync server unreachable renders from local cache', async ({
  context,
  page,
  browser,
}) => {
  const scenario: DualReviewerScenario = await seedDualReviewerScenario();
  const bobCtx = await browser.newContext();
  try {
    const bobPage = await memberReloadWhileUnreachable(
      context,
      page,
      bobCtx,
      scenario,
      'Bughunt Member Cache',
    );

    await expect(bobPage.getByRole('tab', { name: /Reconcile/i })).toBeVisible({
      timeout: 30_000,
    });
  } finally {
    await bobCtx.close();
    await cleanupScenario(scenario);
  }
});
