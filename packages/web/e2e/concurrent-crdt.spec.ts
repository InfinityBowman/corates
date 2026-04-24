/**
 * E2E Test: Concurrent CRDT Editing + Persistence
 *
 * Two reviewers open their own checklists simultaneously in separate
 * browser contexts and make edits at the same time. Both sets of
 * answers flow through the same Yjs Y.Doc via WebSocket, are persisted
 * to the Durable Object's SQLite, and must survive a reload.
 *
 * Covers AMSTAR2 (radio-based verdicts) and ROB2 (toggle-button
 * signalling questions with domain sections).
 *
 * This catches regressions where concurrent Y.Map writes from two
 * WebSocket clients cause dropped updates, merge corruption, or
 * persistence holes that unit tests can't reproduce (they stub
 * timing and the WebSocket layer).
 *
 * Prerequisites:
 *   pnpm --filter web dev  (localhost:3010, DEV_MODE=true)
 */

import { test, expect, type Page, type Browser } from '@playwright/test';
import {
  seedDualReviewerScenario,
  cleanupScenario,
  loginAs,
  addProjectMember,
  type DualReviewerScenario,
} from './helpers';
import {
  createProject,
  addStudyViaPdf,
  assignReviewers,
  addOutcome,
  fillROB2Preliminary,
} from './shared-steps';
import { BASE_URL } from './constants';

// ================================================================
// Helpers
// ================================================================

async function countCheckedCheckboxes(page: Page): Promise<number> {
  return page.getByRole('checkbox', { checked: true }).count();
}

/**
 * Check the first N unchecked checkboxes on the page.
 * AMSTAR2 checkboxes are evidence-criteria inputs -- each is
 * independent, with no auto-derivation side effects that would
 * flip other inputs.
 */
async function clickUncheckedCheckboxes(page: Page, count: number): Promise<number> {
  const boxes = page.getByRole('checkbox');
  const total = await boxes.count();
  let clicked = 0;
  for (let i = 0; i < total && clicked < count; i++) {
    if (!(await boxes.nth(i).isChecked())) {
      await boxes.nth(i).click();
      await page.waitForTimeout(100);
      clicked++;
    }
  }
  return clicked;
}

/**
 * Count ROB2 toggle buttons that are currently selected for a given answer.
 * Selected buttons have the `border-blue-400` class.
 */
async function countSelectedROB2Buttons(page: Page, answer: string): Promise<number> {
  const buttons = page.getByRole('button', { name: answer, exact: true });
  const total = await buttons.count();
  let selected = 0;
  for (let i = 0; i < total; i++) {
    const classes = (await buttons.nth(i).getAttribute('class')) ?? '';
    if (classes.includes('border-blue')) {
      selected++;
    }
  }
  return selected;
}

/**
 * Click the first N unselected ROB2 toggle buttons matching an answer.
 */
async function clickROB2Buttons(page: Page, answer: string, count: number): Promise<number> {
  const buttons = page.getByRole('button', { name: answer, exact: true });
  const total = await buttons.count();
  let clicked = 0;
  for (let i = 0; i < total && clicked < count; i++) {
    const classes = (await buttons.nth(i).getAttribute('class')) ?? '';
    if (!classes.includes('border-blue')) {
      await buttons.nth(i).click();
      await page.waitForTimeout(100);
      clicked++;
    }
  }
  return clicked;
}

/**
 * Open User B's checklist from the To Do tab, handling the read-only
 * ordering ambiguity that shows up when two checklists exist.
 */
async function openEditableChecklist(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Open', exact: true }).last().click();
  await expect(page).toHaveURL(/\/checklists\//, { timeout: 10_000 });

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
  }

  return new URL(page.url()).pathname;
}

/**
 * Run the concurrent-edit + reload cycle. Works for any checklist type
 * as long as the caller provides functions to click answers and count
 * selected answers.
 */
async function runConcurrentEditCycle(
  browser: Browser,
  scenario: DualReviewerScenario,
  projectId: string,
  checklistUrlA: string,
  checklistUrlB: string,
  opts: {
    loadedSelector: string;
    clickA: (page: Page, count: number) => Promise<number>;
    clickB: (page: Page, count: number) => Promise<number>;
    countA: (page: Page) => Promise<number>;
    countB: (page: Page) => Promise<number>;
    round1Count: number;
    round2Count: number;
  },
) {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await loginAs(contextA, scenario.cookiesA);
  await loginAs(contextB, scenario.cookiesB);

  try {
    await pageA.goto(`${BASE_URL}/dashboard`);
    await pageB.goto(`${BASE_URL}/dashboard`);
    await expect(pageA.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });
    await expect(pageB.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });

    await pageA.goto(`${BASE_URL}${checklistUrlA}`);
    await pageB.goto(`${BASE_URL}${checklistUrlB}`);

    await expect(pageA.getByText(opts.loadedSelector)).toBeVisible({ timeout: 15_000 });
    await expect(pageB.getByText(opts.loadedSelector)).toBeVisible({ timeout: 15_000 });
    await pageA.waitForTimeout(2000);
    await pageB.waitForTimeout(2000);

    // ---- Round 1: concurrent edits ----
    await Promise.all([opts.clickA(pageA, opts.round1Count), opts.clickB(pageB, opts.round1Count)]);

    await pageA.waitForTimeout(3000);
    await pageB.waitForTimeout(3000);

    // AMSTAR2's auto-derivation can flip radios, so count what's
    // actually checked rather than assuming 1:1 with clicks.
    const countA1 = await opts.countA(pageA);
    const countB1 = await opts.countB(pageB);

    expect(countA1).toBeGreaterThan(0);
    expect(countB1).toBeGreaterThan(0);

    // ---- Reload: verify persistence ----
    await Promise.all([pageA.reload(), pageB.reload()]);
    await Promise.all([
      pageA.waitForLoadState('networkidle'),
      pageB.waitForLoadState('networkidle'),
    ]);
    await pageA.waitForTimeout(3000);
    await pageB.waitForTimeout(3000);

    expect(await opts.countA(pageA)).toBe(countA1);
    expect(await opts.countB(pageB)).toBe(countB1);

    // ---- Round 2: post-cold-load concurrent edits ----
    await Promise.all([opts.clickA(pageA, opts.round2Count), opts.clickB(pageB, opts.round2Count)]);

    await pageA.waitForTimeout(3000);
    await pageB.waitForTimeout(3000);

    const countA2 = await opts.countA(pageA);
    const countB2 = await opts.countB(pageB);

    // Post-cold-load edits should change the state
    expect(countA2).not.toBe(countA1);
    expect(countB2).not.toBe(countB1);

    // ---- Final reload: round-2 edits also persisted ----
    await Promise.all([pageA.reload(), pageB.reload()]);
    await Promise.all([
      pageA.waitForLoadState('networkidle'),
      pageB.waitForLoadState('networkidle'),
    ]);
    await pageA.waitForTimeout(3000);
    await pageB.waitForTimeout(3000);

    expect(await opts.countA(pageA)).toBe(countA2);
    expect(await opts.countB(pageB)).toBe(countB2);

    // ---- Cross-check: project page still shows the study ----
    await pageA.goto(`${BASE_URL}/projects/${projectId}`);
    await pageA.waitForTimeout(2000);
    await pageA.getByRole('tab', { name: /To Do/i }).click();
    await pageA.waitForTimeout(1000);
    await expect(pageA.getByText(/Petrie2019/i).first()).toBeVisible({ timeout: 5_000 });
  } finally {
    await contextA.close();
    await contextB.close();
  }
}

// ================================================================
// AMSTAR2
// ================================================================

test.describe('Concurrent CRDT: AMSTAR2', () => {
  let scenario: DualReviewerScenario;

  test.beforeAll(async () => {
    scenario = await seedDualReviewerScenario();
  });

  test.afterAll(async () => {
    if (scenario) await cleanupScenario(scenario);
  });

  test('Concurrent AMSTAR2 edits from two reviewers converge and persist', async ({ browser }) => {
    const setupCtx = await browser.newContext();
    const setupPage = await setupCtx.newPage();

    await loginAs(setupCtx, scenario.cookiesA);
    await setupPage.goto(`${BASE_URL}/dashboard`);
    await expect(setupPage.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });

    const projectId = await createProject(setupPage, 'AMSTAR2 CRDT Test');
    await addProjectMember(scenario.orgId, projectId, scenario.userB.id, scenario.cookiesA);
    await setupPage.waitForTimeout(2000);
    await addStudyViaPdf(setupPage);
    await assignReviewers(setupPage);

    // User A adds checklist
    await setupPage.getByRole('tab', { name: /To Do/i }).click();
    await setupPage.waitForTimeout(1000);
    await setupPage.getByRole('button', { name: /Select Checklist/i }).click();
    await setupPage.getByRole('button', { name: /Add Checklist/i }).click();
    await setupPage.waitForTimeout(1000);

    await setupPage.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(setupPage).toHaveURL(/\/checklists\//, { timeout: 10_000 });
    const checklistUrlA = new URL(setupPage.url()).pathname;
    await setupPage.goto(`${BASE_URL}/projects/${projectId}`);
    await setupPage.waitForTimeout(2000);

    // Switch to User B
    await setupCtx.clearCookies();
    await loginAs(setupCtx, scenario.cookiesB);
    await setupPage.goto(`${BASE_URL}/projects/${projectId}`);
    await expect(setupPage.getByText('AMSTAR2 CRDT Test').first()).toBeVisible({ timeout: 15_000 });

    await setupPage.getByRole('tab', { name: /To Do/i }).click();
    await setupPage.waitForTimeout(1000);
    await setupPage.getByRole('button', { name: /Select Checklist/i }).click();
    await setupPage.getByRole('button', { name: /Add Checklist/i }).click();
    await setupPage.waitForTimeout(1000);

    const checklistUrlB = await openEditableChecklist(setupPage);
    await setupCtx.close();

    await runConcurrentEditCycle(browser, scenario, projectId, checklistUrlA, checklistUrlB, {
      loadedSelector: 'AMSTAR2 Checklist',
      clickA: (page, count) => clickUncheckedCheckboxes(page, count),
      clickB: (page, count) => clickUncheckedCheckboxes(page, count),
      countA: page => countCheckedCheckboxes(page),
      countB: page => countCheckedCheckboxes(page),
      round1Count: 5,
      round2Count: 3,
    });
  });
});

// ================================================================
// ROB2
// ================================================================

test.describe('Concurrent CRDT: ROB2', () => {
  let scenario: DualReviewerScenario;

  test.beforeAll(async () => {
    scenario = await seedDualReviewerScenario();
  });

  test.afterAll(async () => {
    if (scenario) await cleanupScenario(scenario);
  });

  test('Concurrent ROB2 edits from two reviewers converge and persist', async ({ browser }) => {
    const setupCtx = await browser.newContext();
    const setupPage = await setupCtx.newPage();

    await loginAs(setupCtx, scenario.cookiesA);
    await setupPage.goto(`${BASE_URL}/dashboard`);
    await expect(setupPage.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });

    const projectId = await createProject(setupPage, 'ROB2 CRDT Test');
    await addProjectMember(scenario.orgId, projectId, scenario.userB.id, scenario.cookiesA);
    await setupPage.waitForTimeout(2000);
    await addStudyViaPdf(setupPage);
    await assignReviewers(setupPage);

    // ROB2 requires an outcome
    await addOutcome(setupPage, 'Primary outcome');

    // User A adds ROB2 checklist
    await setupPage.getByRole('tab', { name: /To Do/i }).click();
    await setupPage.waitForTimeout(1000);
    await setupPage.getByRole('button', { name: /Select Checklist/i }).click();
    await setupPage.getByText(/AMSTAR 2/i).click();
    await setupPage.getByRole('option', { name: /RoB 2/i }).click();
    await setupPage.getByText(/Select outcome/i).click();
    await setupPage.getByRole('option', { name: /Primary outcome/i }).click();
    await setupPage.getByRole('button', { name: /Add Checklist/i }).click();
    await setupPage.waitForTimeout(1000);

    await setupPage.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(setupPage).toHaveURL(/\/checklists\//, { timeout: 10_000 });
    await setupPage.waitForTimeout(2000);

    // Fill preliminary so domain questions are visible
    await fillROB2Preliminary(setupPage, 'Drug A', 'Placebo');
    await setupPage.waitForTimeout(1000);

    const checklistUrlA = new URL(setupPage.url()).pathname;
    await setupPage.goto(`${BASE_URL}/projects/${projectId}`);
    await setupPage.waitForTimeout(2000);

    // Switch to User B
    await setupCtx.clearCookies();
    await loginAs(setupCtx, scenario.cookiesB);
    await setupPage.goto(`${BASE_URL}/projects/${projectId}`);
    await expect(setupPage.getByText('ROB2 CRDT Test').first()).toBeVisible({ timeout: 15_000 });

    await setupPage.getByRole('tab', { name: /To Do/i }).click();
    await setupPage.waitForTimeout(1000);
    await setupPage.getByRole('button', { name: /Select Checklist/i }).click();
    await setupPage.getByText(/AMSTAR 2/i).click();
    await setupPage.getByRole('option', { name: /RoB 2/i }).click();
    await setupPage.getByText(/Select outcome/i).click();
    await setupPage.getByRole('option', { name: /Primary outcome/i }).click();
    await setupPage.getByRole('button', { name: /Add Checklist/i }).click();
    await setupPage.waitForTimeout(1000);

    const checklistUrlB = await openEditableChecklist(setupPage);

    // Fill preliminary for User B too
    await setupPage.waitForTimeout(2000);
    await fillROB2Preliminary(setupPage, 'Drug B', 'Standard care');
    await setupPage.waitForTimeout(1000);

    await setupCtx.close();

    // ROB2 uses toggle buttons (Y/PY/PN/N/NI) instead of radios.
    // Expand D1 on both pages before clicking, since domain sections
    // are collapsible. The concurrent cycle will click within D1's
    // visible signalling questions.
    await runConcurrentEditCycle(browser, scenario, projectId, checklistUrlA, checklistUrlB, {
      loadedSelector: 'D1',
      clickA: async (page, count) => {
        await page.getByRole('button', { name: 'D1', exact: true }).click();
        await page.waitForTimeout(500);
        return clickROB2Buttons(page, 'Y', count);
      },
      clickB: async (page, count) => {
        await page.getByRole('button', { name: 'D1', exact: true }).click();
        await page.waitForTimeout(500);
        return clickROB2Buttons(page, 'N', count);
      },
      countA: page => countSelectedROB2Buttons(page, 'Y'),
      countB: page => countSelectedROB2Buttons(page, 'N'),
      round1Count: 3,
      round2Count: 2,
    });
  });
});
