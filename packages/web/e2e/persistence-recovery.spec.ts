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
 *   pnpm dev:workers  (localhost:8787, DEV_MODE=true)
 *   pnpm dev          (localhost:3010)
 *
 * See: packages/docs/audits/yjs-persistence-redesign.md
 */

import { test, expect } from '@playwright/test';
import { seedDualReviewerScenario, cleanupScenario, type DualReviewerScenario } from './helpers';
import { setupProjectWithStudy } from './shared-steps';

let scenario: DualReviewerScenario;

test.beforeAll(async () => {
  scenario = await seedDualReviewerScenario();
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
async function countCheckedYesRadios(page: import('@playwright/test').Page): Promise<number> {
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
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: /Select Checklist/i }).click();
  await page.getByRole('button', { name: /Add Checklist/i }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await page.waitForTimeout(2000);

  // Click the first 5 Yes radios to generate observable persistence state.
  // We don't care which specific questions get answered -- just that some
  // updates flow through the persistence layer and are recoverable.
  const yesRadios = page.getByRole('radio', { name: 'Yes' });
  const totalRadios = await yesRadios.count();
  const round1Count = Math.min(5, totalRadios);
  for (let i = 0; i < round1Count; i++) {
    await yesRadios.nth(i).click();
    await page.waitForTimeout(100);
  }
  // Give the WebSocket time to flush updates to the server
  await page.waitForTimeout(2000);

  const checkedAfterRound1 = await countCheckedYesRadios(page);
  expect(checkedAfterRound1).toBeGreaterThan(0);

  // ================================================================
  // Step 3: Hard reload the page and verify the same number of answers
  //         is still checked. This catches the original bug where partial
  //         work disappeared after refresh.
  // ================================================================
  await page.reload();
  await page.waitForLoadState('networkidle');
  // The checklist needs a moment to re-sync from IndexedDB and reattach
  await page.waitForTimeout(3000);

  const checkedAfterReload1 = await countCheckedYesRadios(page);
  expect(checkedAfterReload1).toBe(checkedAfterRound1);

  // ================================================================
  // Step 4: Navigate back to the project and verify the study is still
  //         in the list (catches the original bug where studies vanished)
  // ================================================================
  await page.goto(`/projects/${projectId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  await page.getByRole('tab', { name: /All Studies/i }).click();
  await expect(page.getByText(/1 study in this project/i)).toBeVisible({
    timeout: 10_000,
  });

  // ================================================================
  // Step 5: Make ADDITIONAL edits after the reload, then reload AGAIN.
  //         This proves that the redesigned persistence path works for
  //         updates made after a cold load, not just for state seeded
  //         before the first reload.
  // ================================================================
  await page.getByRole('tab', { name: /To Do/i }).click();
  await page.waitForTimeout(1000);

  // Reopen the same checklist via the "Open" button
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await page.waitForTimeout(2000);

  // Click 3 more Yes radios. We use radios past the round-1 range to add
  // new answers rather than re-clicking already-set ones.
  const yesRadiosRound2 = page.getByRole('radio', { name: 'Yes' });
  const round2Limit = Math.min(round1Count + 3, await yesRadiosRound2.count());
  for (let i = round1Count; i < round2Limit; i++) {
    await yesRadiosRound2.nth(i).click();
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(2000);

  const checkedAfterRound2 = await countCheckedYesRadios(page);
  expect(checkedAfterRound2).toBeGreaterThan(checkedAfterReload1);

  // ================================================================
  // Step 6: Final reload, verify the post-cold-load edits also survived
  // ================================================================
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const checkedAfterReload2 = await countCheckedYesRadios(page);
  expect(checkedAfterReload2).toBe(checkedAfterRound2);

  // And the study should still be in the project list
  await page.goto(`/projects/${projectId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.getByRole('tab', { name: /All Studies/i }).click();
  await expect(page.getByText(/1 study in this project/i)).toBeVisible({
    timeout: 10_000,
  });
});
