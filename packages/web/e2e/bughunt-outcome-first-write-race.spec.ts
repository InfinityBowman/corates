/**
 * Bug hunt: concurrent first outcomes on a fresh project - one session's
 * outcome is silently and permanently lost (bug #2, container-creation
 * race, outcomes surface).
 *
 * meta.outcomes is a Y.Map created lazily by the FIRST createOutcome call
 * (outcomes.ts). When two clients each create the project's first outcome
 * before seeing each other's update, each client integrates its own
 * container under the same key; Yjs keeps one and discards the other,
 * including the outcome inside it. Unlike the reconciliation surface,
 * there is no recovery scan - the losing outcome is gone from every
 * client with no error.
 *
 * Choreography: the owner has the fresh project open in TWO sessions (two tabs or
 * devices - each session holds its own Y.Doc and socket) with ZERO outcomes. Outcome creation is isOwner-gated, so the racing writers are the same user twice. The sync channel is partitioned on
 * both clients (provider shouldConnect off + socket closed in-page via
 * the dev-mode __connectionPool hook). Each adds one outcome. Both
 * reconnect. EXPECTED: both outcomes exist on both clients (they have
 * unique ids, no true conflict). ACTUAL: one outcome vanishes on both.
 *
 * Which session loses varies with Yjs client ids, so the test asserts
 * BOTH outcomes survive and fails whichever way the collision resolves.
 *
 * Requires dev test server on localhost:3010 (DEV_MODE=true).
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { seedDualReviewerScenario, cleanupScenario, loginAs } from './helpers';
import { setupProjectWithStudy, addOutcome } from './shared-steps';

test.setTimeout(300_000);

const OUTCOME_A = 'Outcome From Session One';
const OUTCOME_B = 'Outcome From Session Two';

async function partitionSync(page: Page, projectId: string) {
  await page.evaluate(pid => {
    const pool = (window as unknown as { __connectionPool: any }).__connectionPool;
    const provider = pool.getEntry(pid)?.connectionManager?.getProvider();
    if (provider) {
      provider.shouldConnect = false;
      provider.ws?.close();
    }
  }, projectId);
  await page.waitForTimeout(500);
}

async function reconnectSync(page: Page, projectId: string) {
  await page.evaluate(pid => {
    const pool = (window as unknown as { __connectionPool: any }).__connectionPool;
    pool.getEntry(pid)?.connectionManager?.reconnect();
  }, projectId);
}

function outcomeNames(page: Page, projectId: string): Promise<string[]> {
  return page.evaluate(pid => {
    const pool = (window as unknown as { __connectionPool: any }).__connectionPool;
    const ydoc = pool.getEntry(pid)?.ydoc;
    const outcomes = ydoc?.getMap('meta')?.get('outcomes');
    const names: string[] = [];
    if (outcomes?.forEach) {
      outcomes.forEach((o: any) => names.push(o?.get?.('name') ?? String(o)));
    }
    return names.sort();
  }, projectId);
}

test('Concurrent first outcomes from two owner sessions: both must survive sync', async ({
  browser,
}) => {
  const scenario = await seedDualReviewerScenario();
  const aliceCtx = await browser.newContext();
  let secondCtx: BrowserContext | undefined;
  try {
    const alicePage = await aliceCtx.newPage();
    // The Outcomes manager only renders once the project has a study, so
    // use the full scaffold (project + member + study + reviewers).
    const projectId = await setupProjectWithStudy(
      aliceCtx,
      alicePage,
      scenario,
      'Bughunt Outcome Race',
    );

    // Second session of the SAME owner (outcome creation is isOwner-gated):
    // a second browser context models a second tab or device, which holds
    // its own Y.Doc instance and its own sync socket.
    secondCtx = await browser.newContext();
    const secondPage = await secondCtx.newPage();
    await loginAs(secondCtx, scenario.cookiesA);
    await secondPage.goto('/dashboard');
    await expect(secondPage.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });
    await secondPage.goto(`/projects/${projectId}`);
    await expect(secondPage.getByRole('tab', { name: /All Studies/i })).toBeVisible({
      timeout: 20_000,
    });

    // Partition, then each session creates the project's FIRST outcome
    await partitionSync(alicePage, projectId);
    await partitionSync(secondPage, projectId);

    await addOutcome(alicePage, OUTCOME_A);
    await addOutcome(secondPage, OUTCOME_B);

    // Guard the guard: each client must see only its own outcome while
    // partitioned, or the run proves nothing.
    expect(await outcomeNames(alicePage, projectId)).toEqual([OUTCOME_A]);
    expect(await outcomeNames(secondPage, projectId)).toEqual([OUTCOME_B]);

    // Reconnect and let the docs converge
    await reconnectSync(secondPage, projectId);
    await reconnectSync(alicePage, projectId);
    await alicePage.waitForTimeout(8_000);
    await secondPage.waitForTimeout(1_000);

    // Both outcomes must survive on both clients
    const expected = [OUTCOME_A, OUTCOME_B].sort();
    expect(
      await outcomeNames(alicePage, projectId),
      "one session's outcome was destroyed by the container race (session 1 view)",
    ).toEqual(expected);
    expect(
      await outcomeNames(secondPage, projectId),
      "one session's outcome was destroyed by the container race (session 2 view)",
    ).toEqual(expected);

    // And the survivor set must be visible in the UI, not just the doc
    for (const page of [alicePage, secondPage]) {
      await page.getByRole('tab', { name: /All Studies/i }).click();
      await page.getByText('Outcomes', { exact: true }).click();
      await expect(page.getByText(OUTCOME_A)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(OUTCOME_B)).toBeVisible({ timeout: 10_000 });
    }
  } finally {
    await aliceCtx.close();
    if (secondCtx) await secondCtx.close();
    await cleanupScenario(scenario);
  }
});
