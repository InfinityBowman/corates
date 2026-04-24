/**
 * E2E Test: Realtime Collaboration in Reconciliation
 *
 * Tests that Yjs awareness (presence avatars, cursor sync) and Y.Text
 * (text field editing) propagate correctly between two users viewing
 * the same reconciliation page simultaneously in separate browser contexts.
 *
 * Setup phase (sequential, single context):
 *   1. Create project with study, assign both reviewers
 *   2. User A fills AMSTAR2 checklist, marks complete
 *   3. User B fills AMSTAR2 checklist (different answers), marks complete
 *
 * Realtime phase (concurrent, two contexts):
 *   1. Both users open the reconciliation view
 *   2. Verify presence avatars appear via awareness protocol
 *   3. Verify cursor position syncs between users
 *   4. Verify text editing in the Final Note syncs via Y.Text
 *
 * Prerequisites:
 *   pnpm --filter web dev  (localhost:3010, DEV_MODE=true)
 */

import { test, expect, type Page } from '@playwright/test';
import {
  seedDualReviewerScenario,
  cleanupScenario,
  loginAs,
  switchUser,
  addProjectMember,
  type DualReviewerScenario,
} from './helpers';
import {
  createProject,
  addStudyViaPdf,
  assignReviewers,
  markChecklistComplete,
} from './shared-steps';
import { BASE_URL } from './constants';


let scenario: DualReviewerScenario;

test.beforeAll(async () => {
  scenario = await seedDualReviewerScenario();
});

test.afterAll(async () => {
  if (scenario) await cleanupScenario(scenario);
});

/**
 * Click the first radio in each radio group (selects "Yes" for every question).
 * AMSTAR2 renders all 16 questions (including Q9a/b and Q11a/b splits) on one
 * scrollable page. Only the verdict column uses radio inputs.
 */
async function answerAllAMSTAR2Yes(page: Page) {
  const allRadios = page.locator('input[type="radio"]');
  const count = await allRadios.count();
  const seen = new Set<string>();

  for (let i = 0; i < count; i++) {
    const name = await allRadios.nth(i).getAttribute('name');
    if (name && !seen.has(name)) {
      seen.add(name);
      await allRadios.nth(i).scrollIntoViewIfNeeded();
      await allRadios.nth(i).click();
      await page.waitForTimeout(50);
    }
  }
}

/**
 * Click the last radio in each radio group (selects "No" or equivalent).
 * Creates disagreement with a "Yes" checklist for every question.
 */
async function answerAllAMSTAR2No(page: Page) {
  const allRadios = page.locator('input[type="radio"]');
  const count = await allRadios.count();

  const lastByGroup = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const name = await allRadios.nth(i).getAttribute('name');
    if (name) lastByGroup.set(name, i);
  }

  for (const idx of lastByGroup.values()) {
    await allRadios.nth(idx).scrollIntoViewIfNeeded();
    await allRadios.nth(idx).click();
    await page.waitForTimeout(50);
  }
}

test('Presence avatars, cursor sync, and text editing sync during reconciliation', async ({
  browser,
}) => {
  // ================================================================
  // SETUP PHASE - build the full scenario sequentially
  // ================================================================
  const setupCtx = await browser.newContext();
  const page = await setupCtx.newPage();

  await loginAs(setupCtx, scenario.cookiesA);
  await page.goto(`${BASE_URL}/dashboard`);
  await expect(page.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });

  const projectId = await createProject(page, 'Realtime Reconcile Test');
  await addProjectMember(scenario.orgId, projectId, scenario.userB.id, scenario.cookiesA);
  await page.waitForTimeout(2000);
  await addStudyViaPdf(page);
  await assignReviewers(page);

  // User A: add AMSTAR2 checklist, answer Yes to everything, mark complete
  await page.getByRole('tab', { name: /To Do/i }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /Select Checklist/i }).click();
  await page.getByRole('button', { name: /Add Checklist/i }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await page.waitForTimeout(2000);

  await answerAllAMSTAR2Yes(page);
  await page.waitForTimeout(500);
  await markChecklistComplete(page);
  await page.goto(`${BASE_URL}/projects/${projectId}`);
  await page.waitForTimeout(2000);

  // User B: add AMSTAR2 checklist, answer No to everything, mark complete
  await switchUser(setupCtx, scenario.cookiesB);
  await page.goto(`${BASE_URL}/projects/${projectId}`);
  await expect(page.getByText('Realtime Reconcile Test').first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole('tab', { name: /To Do/i }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /Select Checklist/i }).click();
  await page.getByRole('button', { name: /Add Checklist/i }).click();
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: 'Open', exact: true }).last().click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
  await page.waitForTimeout(2000);

  if (
    await page
      .getByText('Read-only')
      .isVisible()
      .catch(() => false)
  ) {
    await page.goBack();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Open', exact: true }).first().click();
    await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });
    await page.waitForTimeout(2000);
  }

  await answerAllAMSTAR2No(page);
  await page.waitForTimeout(500);
  await markChecklistComplete(page);
  await page.goto(`${BASE_URL}/projects/${projectId}`);
  await page.waitForTimeout(2000);

  // Navigate to reconciliation and grab the URL
  await page.getByRole('tab', { name: /Reconcile/i }).click();
  await page.waitForTimeout(2000);
  await expect(page.getByText('Ready')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /Reconcile/i }).click();
  await expect(page).toHaveURL(/\/reconcile\//, { timeout: 10_000 });
  await page.waitForTimeout(2000);
  const reconcilePath = new URL(page.url()).pathname;

  // ================================================================
  // REALTIME PHASE - reuse setup context for User A, new context for User B
  // Avoids fresh-context auth issues: the setup context already has
  // working cookies and cached state.
  // ================================================================
  await switchUser(setupCtx, scenario.cookiesA);
  const pageA = page;

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await loginAs(contextB, scenario.cookiesB);

  try {
    // User B establishes auth by visiting dashboard first
    await pageB.goto(`${BASE_URL}/dashboard`);
    await expect(pageB.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });

    // Both users navigate to the reconciliation page
    await pageA.goto(`${BASE_URL}${reconcilePath}`);
    await pageB.goto(`${BASE_URL}${reconcilePath}`);

    // Wait for reconciliation UI and Yjs WebSocket connections
    await expect(pageA.getByText(/Question 1 of/i)).toBeVisible({ timeout: 30_000 });
    await expect(pageB.getByText(/Question 1 of/i)).toBeVisible({ timeout: 30_000 });
    await pageA.waitForTimeout(3000);
    await pageB.waitForTimeout(3000);

    // ================================================================
    // TEST 1: Presence avatars
    // PresenceAvatars renders in the header when awareness detects
    // a remote user. Avatars show initials as fallback text.
    // ================================================================
    // User A should see Bob's avatar ("BR" for "Bob Reviewer")
    const bobAvatar = pageA.locator('.-space-x-2').getByText('BR');
    await expect(bobAvatar).toBeVisible({ timeout: 15_000 });

    // User B should see Alice's avatar ("AR" for "Alice Reviewer")
    const aliceAvatar = pageB.locator('.-space-x-2').getByText('AR');
    await expect(aliceAvatar).toBeVisible({ timeout: 15_000 });

    // ================================================================
    // TEST 2: Cursor sync
    // Moving the mouse on User A's reconciliation content should
    // render a floating cursor with Alice's name on User B's screen.
    // ================================================================
    await pageA.mouse.move(400, 400);
    await pageA.waitForTimeout(500);

    // RemoteCursors overlay is pointer-events-none and shows the name
    const remoteCursor = pageB.locator('.pointer-events-none').getByText('Alice Reviewer');
    await expect(remoteCursor).toBeVisible({ timeout: 10_000 });

    // ================================================================
    // TEST 3: Text editing sync via Y.Text
    // User A types in the Final Note textarea on the current question,
    // User B should see the text appear without refreshing.
    // ================================================================
    // Expand the collapsed "Question Notes" section on both pages
    await pageA.getByText('Question Notes').click();
    await pageA.waitForTimeout(500);
    await pageB.getByText('Question Notes').click();
    await pageB.waitForTimeout(500);

    // User A fills the Final Note
    const finalNoteA = pageA.locator('textarea[placeholder="Add the final reconciled note..."]');
    await finalNoteA.fill('Agreed to use conservative estimate');
    await pageA.waitForTimeout(1000);

    // User B should see the same text via Y.Text sync
    const finalNoteB = pageB.locator('textarea[placeholder="Add the final reconciled note..."]');
    await expect(finalNoteB).toHaveValue('Agreed to use conservative estimate', {
      timeout: 15_000,
    });
  } finally {
    await setupCtx.close();
    await contextB.close();
  }
});
