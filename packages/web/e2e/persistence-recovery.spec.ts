/**
 * E2E test: Project state survives page refresh
 *
 * This test reproduces the user-reported "I refresh and my studies disappear"
 * scenario end-to-end against the dev server. It covers the entire stack:
 * client edits -> WebSocket -> ProjectDoc DO -> SQLite persistence -> reload ->
 * cold load from SQL -> render.
 *
 * It is the user-facing complement to the unit tests in
 * packages/workers/src/durable-objects/__tests__/ProjectDoc.persistence.test.ts.
 *
 * Prerequisites:
 *   pnpm --filter web dev  (localhost:3010, DEV_MODE=true)
 *
 * See: packages/docs/audits/yjs-persistence-redesign.md
 */

import { test, expect, type Page } from '@playwright/test';
import {
  seedDualReviewerScenario,
  cleanupScenario,
  seedStudies,
  updateSubscription,
  type DualReviewerScenario,
} from './helpers';
import { setupProjectWithStudy } from './shared-steps';

let scenario: DualReviewerScenario;

test.beforeAll(async () => {
  scenario = await seedDualReviewerScenario();
  await updateSubscription(scenario.orgId, { plan: 'unlimited_team' });
});

test.afterAll(async () => {
  if (scenario) await cleanupScenario(scenario);
});

/**
 * Count how many Yes radios are currently checked. Used as a robust
 * persistence-survived signal: AMSTAR2 has multiple Yes radios per question
 * (each row + column variant), so tracking specific indices is brittle.
 * Counting the total checked-state lets us assert that the same number of
 * answers are present after a reload as before, regardless of DOM order.
 */
async function countCheckedYesRadios(page: Page): Promise<number> {
  const radios = page.getByRole('radio', { name: 'Yes' });
  const count = await radios.count();
  let checked = 0;
  for (let i = 0; i < count; i++) {
    if (await radios.nth(i).isChecked()) {
      checked++;
    }
  }
  return checked;
}

test('Project state survives page refresh', async ({ context, page }) => {
  // Create a project with one study and assigned reviewers, then verify the
  // study is present after a hard reload.
  const projectId = await setupProjectWithStudy(
    context,
    page,
    scenario,
    'Persistence Recovery E2E',
  );

  // ================================================================
  // Step 1: After project setup, verify the study is visible
  // ================================================================
  await page.getByRole('tab', { name: /All Studies/i }).click();
  await expect(page.getByText(/1 study in this project/i)).toBeVisible({
    timeout: 10_000,
  });

  // ================================================================
  // Step 2: Open a checklist as User A and answer some questions, but
  //         do NOT mark the checklist complete. We want to confirm that
  //         partial in-progress state survives the refresh.
  // ================================================================
  await page.getByRole('tab', { name: /To Do/i }).click();
  await expect(page.getByRole('button', { name: /Select Checklist/i })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole('button', { name: /Select Checklist/i }).click();
  await page.getByRole('button', { name: /Add Checklist/i }).click();
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await expect(page.getByRole('radio', { name: 'Yes' }).first()).toBeVisible({ timeout: 10_000 });

  // Click the first 5 Yes radios to generate observable persistence state.
  // We don't care which specific questions get answered -- just that some
  // updates flow through the persistence layer and are recoverable.
  const yesRadios = page.getByRole('radio', { name: 'Yes' });
  const totalRadios = await yesRadios.count();
  const round1Count = Math.min(5, totalRadios);
  for (let i = 0; i < round1Count; i++) {
    await yesRadios.nth(i).click();
    await expect(yesRadios.nth(i)).toBeChecked({ timeout: 5_000 });
  }
  // Give the WebSocket time to flush updates to the server
  await page.waitForTimeout(1000);

  const checkedAfterRound1 = await countCheckedYesRadios(page);
  expect(checkedAfterRound1).toBeGreaterThan(0);

  // ================================================================
  // Step 3: Hard reload the page and verify the same number of answers
  //         is still checked. This catches the original bug where partial
  //         work disappeared after refresh.
  // ================================================================
  await page.reload();
  // Wait for checklist to re-sync from IndexedDB
  await expect(page.getByRole('radio', { name: 'Yes' }).first()).toBeVisible({ timeout: 10_000 });

  await expect(async () => {
    expect(await countCheckedYesRadios(page)).toBe(checkedAfterRound1);
  }).toPass({ timeout: 10_000 });
  const checkedAfterReload1 = await countCheckedYesRadios(page);

  // ================================================================
  // Step 4: Navigate back to the project and verify the study is still
  //         in the list (catches the original bug where studies vanished)
  // ================================================================
  await page.goto(`/projects/${projectId}`);

  await page.getByRole('tab', { name: /All Studies/i }).click();
  await expect(page.getByText(/1 study in this project/i)).toBeVisible({
    timeout: 15_000,
  });

  // ================================================================
  // Step 5: Make ADDITIONAL edits after the reload, then reload AGAIN.
  //         This proves that the redesigned persistence path works for
  //         updates made after a cold load, not just for state seeded
  //         before the first reload.
  // ================================================================
  await page.getByRole('tab', { name: /To Do/i }).click();
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible({
    timeout: 10_000,
  });

  // Reopen the same checklist via the "Open" button
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await expect(page.getByRole('radio', { name: 'Yes' }).first()).toBeVisible({ timeout: 10_000 });

  // Click 3 more Yes radios. We use radios past the round-1 range to add
  // new answers rather than re-clicking already-set ones.
  const yesRadiosRound2 = page.getByRole('radio', { name: 'Yes' });
  const round2Limit = Math.min(round1Count + 3, await yesRadiosRound2.count());
  for (let i = round1Count; i < round2Limit; i++) {
    await yesRadiosRound2.nth(i).click();
    await expect(yesRadiosRound2.nth(i)).toBeChecked({ timeout: 5_000 });
  }
  await page.waitForTimeout(1000);

  const checkedAfterRound2 = await countCheckedYesRadios(page);
  expect(checkedAfterRound2).toBeGreaterThan(checkedAfterReload1);

  // ================================================================
  // Step 6: Final reload, verify the post-cold-load edits also survived
  // ================================================================
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Yes' }).first()).toBeVisible({ timeout: 10_000 });

  await expect(async () => {
    expect(await countCheckedYesRadios(page)).toBe(checkedAfterRound2);
  }).toPass({ timeout: 10_000 });

  // And the study should still be in the project list
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('tab', { name: /All Studies/i }).click();
  await expect(page.getByText(/1 study in this project/i)).toBeVisible({
    timeout: 10_000,
  });
});

test('Checklist answers survive reload with sync unavailable (local IndexedDB only)', async ({
  context,
  page,
}) => {
  // The other reload tests run with the WebSocket reachable, so a broken
  // local persistence path could be masked by the server re-syncing the doc
  // on load. Here we intercept the sync WebSocket before reloading: the app
  // still boots over HTTP, but no doc data can arrive from the server, so
  // any restored answers must have come from IndexedDB via y-dexie.
  await setupProjectWithStudy(context, page, scenario, 'Offline Persistence E2E');

  await page.getByRole('tab', { name: /To Do/i }).click();
  await expect(page.getByRole('button', { name: /Select Checklist/i })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole('button', { name: /Select Checklist/i }).click();
  await page.getByRole('button', { name: /Add Checklist/i }).click();
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await expect(page.getByRole('radio', { name: 'Yes' }).first()).toBeVisible({ timeout: 10_000 });

  const yesRadios = page.getByRole('radio', { name: 'Yes' });
  const round1Count = Math.min(5, await yesRadios.count());
  for (let i = 0; i < round1Count; i++) {
    await yesRadios.nth(i).click();
    await expect(yesRadios.nth(i)).toBeChecked({ timeout: 5_000 });
  }
  // Let y-dexie flush the updates to IndexedDB before we reload
  await page.waitForTimeout(1000);
  const checkedBeforeOffline = await countCheckedYesRadios(page);
  expect(checkedBeforeOffline).toBeGreaterThan(0);

  // Intercept all future sync WebSockets: they open but never reach the
  // server, so the doc cannot be refilled remotely. The counter guards the
  // guard: if the sync endpoint URL changes and the pattern stops matching,
  // the final assertion fails instead of the test silently running with a
  // live server connection.
  let interceptedSyncSockets = 0;
  await page.routeWebSocket(/\/api\/project-doc/, () => {
    interceptedSyncSockets++;
  });

  await page.reload();
  await expect(page.getByRole('radio', { name: 'Yes' }).first()).toBeVisible({ timeout: 10_000 });
  await expect(async () => {
    expect(await countCheckedYesRadios(page)).toBe(checkedBeforeOffline);
  }).toPass({ timeout: 10_000 });

  // Make additional edits while sync is unavailable, reload again, and
  // verify they also survive -- local writes must not depend on the server
  // acknowledging them.
  const yesRadiosOffline = page.getByRole('radio', { name: 'Yes' });
  const round2Limit = Math.min(round1Count + 3, await yesRadiosOffline.count());
  for (let i = round1Count; i < round2Limit; i++) {
    await yesRadiosOffline.nth(i).click();
    await expect(yesRadiosOffline.nth(i)).toBeChecked({ timeout: 5_000 });
  }
  await page.waitForTimeout(1000);
  const checkedWhileOffline = await countCheckedYesRadios(page);
  expect(checkedWhileOffline).toBeGreaterThan(checkedBeforeOffline);

  await page.reload();
  await expect(page.getByRole('radio', { name: 'Yes' }).first()).toBeVisible({ timeout: 10_000 });
  await expect(async () => {
    expect(await countCheckedYesRadios(page)).toBe(checkedWhileOffline);
  }).toPass({ timeout: 10_000 });

  expect(interceptedSyncSockets).toBeGreaterThan(0);
});

test('Project data survives navigate-away and navigate-back (cached phase)', async ({
  context,
  page,
}) => {
  const projectId = await setupProjectWithStudy(context, page, scenario, 'Cache Revisit E2E');

  // Verify study is present after initial setup
  await page.getByRole('tab', { name: /All Studies/i }).click();
  await expect(page.getByText(/1 study in this project/i)).toBeVisible({ timeout: 10_000 });

  // Navigate away to dashboard (releases the connection, destroys Y.Doc in memory)
  await page.goto('/dashboard');
  await expect(page.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });

  // Navigate back -- Dexie cache should render the study via the cached phase
  // before the WebSocket finishes syncing
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('tab', { name: /All Studies/i }).click();
  await expect(page.getByText(/1 study in this project/i)).toBeVisible({ timeout: 15_000 });

  // Navigate away and back a second time to confirm the cache + sync pipeline
  // leaves Dexie in a consistent state across multiple visits
  await page.goto('/dashboard');
  await expect(page.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });

  await page.goto(`/projects/${projectId}`);
  await page.getByRole('tab', { name: /All Studies/i }).click();
  await expect(page.getByText(/1 study in this project/i)).toBeVisible({ timeout: 15_000 });
});

test('Concurrent server-side change merges correctly on revisit', async ({ context, page }) => {
  const projectId = await setupProjectWithStudy(
    context,
    page,
    scenario,
    'Concurrent Modification E2E',
  );

  await page.getByRole('tab', { name: /All Studies/i }).click();
  await expect(page.getByText(/1 study in this project/i)).toBeVisible({ timeout: 10_000 });

  // Navigate away so the connection is released
  await page.goto('/dashboard');
  await expect(page.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });

  // While User A is away, add a second study via the server-side API.
  // This simulates another user (or a migration) modifying the project
  // while the first user's Dexie cache has stale data.
  await seedStudies(
    scenario.orgId,
    projectId,
    scenario.cookiesA,
    scenario.userA.id,
    scenario.userB.id,
    1,
    { type: 'AMSTAR2', fillMode: 'random' },
  );

  // Navigate back -- Dexie cache may briefly show 1 study,
  // but after WebSocket sync, both studies should appear
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('tab', { name: /All Studies/i }).click();
  await expect(page.getByText(/2 studies in this project/i)).toBeVisible({ timeout: 30_000 });
});

test('Project actions work after cold reload (no warm query cache)', async ({ context, page }) => {
  await setupProjectWithStudy(context, page, scenario, 'Cold Reload Actions E2E');

  await page.getByRole('tab', { name: /All Studies/i }).click();
  await expect(page.getByText(/1 study in this project/i)).toBeVisible({ timeout: 10_000 });

  const pageErrors: Error[] = [];
  page.on('pageerror', err => pageErrors.push(err));

  // Hard reload clears React Query cache. orgId is not stored in the
  // Y.Doc, so useProjectOrgId permanently returns null after refresh.
  // setActiveProject is never called, and all actions through
  // connectionPool.getActiveOps() fail with "No active project connection".
  await page.reload();

  await page.getByRole('tab', { name: /All Studies/i }).click();
  await expect(page.getByText(/1 study in this project/i)).toBeVisible({ timeout: 15_000 });

  // Wait well past any sync window to prove this is not a race condition.
  await page.waitForTimeout(5_000);

  // Attempt a mutation: this calls project.study.delete() which
  // requires connectionPool.getActiveOps() to be non-null.
  await page.locator('button:has(svg.lucide-ellipsis-vertical)').first().click();
  await page.getByRole('menuitem', { name: /Delete Study/i }).click();
  await page.waitForTimeout(1000);

  const connectionErrors = pageErrors.filter(e =>
    e.message.includes('No active project connection'),
  );
  expect(connectionErrors).toHaveLength(0);
});

test('Rapid navigation does not corrupt state or crash', async ({ context, page }) => {
  const projectId = await setupProjectWithStudy(context, page, scenario, 'Rapid Nav E2E');

  await page.getByRole('tab', { name: /All Studies/i }).click();
  await expect(page.getByText(/1 study in this project/i)).toBeVisible({ timeout: 10_000 });

  // Rapid-fire navigate: project -> dashboard -> project -> dashboard -> project
  // Each transition acquires/releases the connection. Tests ref-counting cleanup
  // and that Dexie cache stays consistent through multiple lifecycles.
  for (let i = 0; i < 3; i++) {
    await page.goto('/dashboard');
    await expect(page.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });

    await page.goto(`/projects/${projectId}`);
    await page.getByRole('tab', { name: /All Studies/i }).click();
    await expect(page.getByText(/1 study in this project/i)).toBeVisible({ timeout: 15_000 });
  }
});
