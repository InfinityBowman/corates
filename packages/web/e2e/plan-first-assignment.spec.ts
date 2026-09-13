/**
 * E2E Test: Plan-first appraisals (#791)
 *
 * A reviewer's ad hoc checklist plans the cell, so the other reviewer's own
 * checklist appears on their To-Do tab without creating anything. Swapping a
 * slot holder who has work in progress asks whether to hand it over; the new
 * reviewer then continues from the same answers and the old one has nothing
 * left to do.
 *
 * Prerequisites:
 *   pnpm --filter web dev  (localhost:3010, DEV_MODE=true)
 */

import { test, expect } from './test';
import {
  addProjectMember,
  cleanupByEmail,
  cleanupScenario,
  seedDualReviewerScenario,
  switchUser,
  testApi,
  uniquePrefix,
  type DualReviewerScenario,
  type SeededUser,
  type SessionCookie,
} from './helpers';
import { setupProjectWithStudy, waitForSynced } from './shared-steps';

let scenario: DualReviewerScenario;
let carol: SeededUser;
let cookiesC: SessionCookie[];

/** A third org member; the seed route ignores conflicts, so the org row is reused. */
async function seedThirdReviewer(orgId: string) {
  const prefix = uniquePrefix('e2e');
  const id = `${prefix}-user-c`;
  const email = `carol-${prefix}@test.corates.org`;
  const seedRes = await testApi('/api/test/seed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      users: [{ id, name: 'Carol Reviewer', email, givenName: 'Carol', familyName: 'Reviewer' }],
      org: { id: orgId, name: 'E2E Test Org' },
      orgMembers: [{ userId: id, role: 'member' }],
    }),
  });
  if (!seedRes.ok) throw new Error(`Seed failed: ${seedRes.status} ${await seedRes.text()}`);
  const sessionRes = await testApi('/api/test/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: id }),
  });
  if (!sessionRes.ok) throw new Error(`Session failed: ${sessionRes.status}`);
  const { cookies } = (await sessionRes.json()) as { cookies: SessionCookie[] };
  return { user: { id, name: 'Carol Reviewer', email }, cookies };
}

test.beforeAll(async () => {
  scenario = await seedDualReviewerScenario();
  const third = await seedThirdReviewer(scenario.orgId);
  carol = third.user;
  cookiesC = third.cookies;
});

test.afterAll(async () => {
  if (carol) await cleanupByEmail(carol.email);
  if (scenario) await cleanupScenario(scenario);
});

test('A planned cell reaches every reviewer, and a swap hands work over', async ({
  context,
  page,
}) => {
  const projectId = await setupProjectWithStudy(context, page, scenario, 'Plan First E2E');
  await addProjectMember(scenario.orgId, projectId, carol.id, scenario.cookiesA);

  // ================================================================
  // Alice adds an AMSTAR2 checklist from To-Do: this plans the cell
  // ================================================================
  await page.getByRole('tab', { name: /To-Do/i }).click();
  await expect(page.getByRole('button', { name: /Select Checklist/i })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole('button', { name: /Select Checklist/i }).click();
  await page.getByRole('button', { name: /Add Checklist/i }).click();
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await waitForSynced(page);

  // ================================================================
  // Bob's To-Do already holds his copy; he starts answering
  // ================================================================
  await switchUser(context, scenario.cookiesB);
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('tab', { name: /To-Do/i }).click();
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('button', { name: /Select Checklist/i })).toHaveCount(0);

  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  const firstYes = page.getByRole('radio', { name: 'Yes' }).first();
  await expect(firstYes).toBeVisible({ timeout: 10_000 });
  await firstYes.click();
  await expect(firstYes).toBeChecked({ timeout: 5_000 });
  await waitForSynced(page);

  // ================================================================
  // Alice replaces Bob with Carol; the sheet asks about Bob's work
  // ================================================================
  await switchUser(context, scenario.cookiesA);
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('tab', { name: /All Studies/i }).click();
  await expect(page.getByTestId('study-card').first()).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('study-card').first().getByTestId('study-card-menu').click();
  await page.getByRole('menuitem', { name: /Assign Reviewers/i }).click();

  const sheet = page.getByTestId('assign-reviewers-sheet');
  await expect(sheet).toBeVisible({ timeout: 5_000 });
  await sheet.getByTestId('reviewer-picker-2').click();
  await expect(page.getByRole('option', { name: /Carol/i })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('option', { name: /Carol/i }).click();
  await expect(page.getByRole('listbox')).toBeHidden({ timeout: 5_000 });
  await sheet.getByRole('button', { name: 'Save reviewers' }).click();

  const prompt = page.getByTestId('in-progress-prompt');
  await expect(prompt).toBeVisible({ timeout: 5_000 });
  await prompt.getByRole('button', { name: 'Hand over' }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
  await waitForSynced(page);

  // ================================================================
  // Carol continues from Bob's answers; Bob has nothing left to do
  // ================================================================
  await switchUser(context, cookiesC);
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('tab', { name: /To-Do/i }).click();
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await expect(page.getByRole('radio', { name: 'Yes' }).first()).toBeChecked({ timeout: 10_000 });

  await switchUser(context, scenario.cookiesB);
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('tab', { name: /To-Do/i }).click();
  await expect(page.getByRole('tab', { name: /To-Do/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toHaveCount(0);
});
