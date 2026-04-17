/**
 * E2E Test: Realtime Collaboration at Scale
 *
 * Prepopulates a project with 50 ROB2 studies (100 filled checklists) via
 * the dev/add-study API, then measures what a user would actually feel:
 *   - Project page load time (Y.Doc sync + render)
 *   - Reconciliation page load time
 *   - Presence sync latency
 *   - Text editing sync latency between two users
 *
 * Prerequisites:
 *   pnpm --filter web dev  (localhost:3010, DEV_MODE=true)
 */

import { test, expect } from '@playwright/test';
import {
  seedDualReviewerScenario,
  cleanupScenario,
  loginAs,
  switchUser,
  addProjectMember,
  seedStudies,
  type DualReviewerScenario,
} from './helpers';
import { createProject } from './shared-steps';

const BASE = 'http://localhost:3010';
const STUDY_COUNT = 50;

// Thresholds in milliseconds -- what a user would tolerate
const MAX_PROJECT_LOAD_MS = 10_000;
const MAX_RECONCILE_LOAD_MS = 10_000;
const MAX_PRESENCE_SYNC_MS = 10_000;
const MAX_TEXT_SYNC_MS = 5_000;

let scenario: DualReviewerScenario;

test.beforeAll(async () => {
  scenario = await seedDualReviewerScenario();
});

test.afterAll(async () => {
  if (scenario) await cleanupScenario(scenario);
});

test(
  `Realtime reconciliation with ${STUDY_COUNT} ROB2 studies`,
  { timeout: 300_000 },
  async ({ browser }) => {
    const timings: Record<string, number> = {};

    // ================================================================
    // SETUP: Create project and bulk-populate via dev API
    // ================================================================
    const setupCtx = await browser.newContext();
    const page = await setupCtx.newPage();

    await loginAs(setupCtx, scenario.cookiesA);
    await page.goto(`${BASE}/dashboard`);
    await expect(page.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });

    const projectId = await createProject(page, `Scale Test (${STUDY_COUNT} studies)`);
    await addProjectMember(scenario.orgId, projectId, scenario.userB.id, scenario.cookiesA);

    const seedStart = Date.now();
    await seedStudies(
      scenario.orgId,
      projectId,
      scenario.cookiesA,
      scenario.userA.id,
      scenario.userB.id,
      STUDY_COUNT,
      { type: 'ROB2', fillMode: 'random' },
    );
    timings.seedStudies = Date.now() - seedStart;

    // ================================================================
    // MEASURE: Project page load (Y.Doc sync + render)
    // ================================================================
    const projectLoadStart = Date.now();
    await page.goto(`${BASE}/projects/${projectId}`);
    await expect(page.getByRole('tab', { name: /Reconcile/i })).toBeVisible({ timeout: 30_000 });
    timings.projectPageLoad = Date.now() - projectLoadStart;

    // Navigate to Reconcile tab and grab the URL
    await page.getByRole('tab', { name: /Reconcile/i }).click();
    await page.waitForTimeout(2000);
    await expect(page.getByText('Ready').first()).toBeVisible({ timeout: 15_000 });

    const reconcileNavStart = Date.now();
    await page
      .getByRole('button', { name: /Reconcile/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/reconcile\//, { timeout: 10_000 });
    await expect(page.getByText(/Item 1 of/i)).toBeVisible({ timeout: 30_000 });
    timings.reconcilePageLoad = Date.now() - reconcileNavStart;

    const reconcilePath = new URL(page.url()).pathname;

    // ================================================================
    // REALTIME PHASE: two users on reconciliation
    // ================================================================
    await switchUser(setupCtx, scenario.cookiesA);
    const pageA = page;

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await loginAs(contextB, scenario.cookiesB);

    try {
      await pageB.goto(`${BASE}/dashboard`);
      await expect(pageB.getByText('Welcome back,')).toBeVisible({ timeout: 15_000 });

      await pageA.goto(`${BASE}${reconcilePath}`);
      await pageB.goto(`${BASE}${reconcilePath}`);

      await expect(pageA.getByText(/Item 1 of/i)).toBeVisible({ timeout: 30_000 });
      await expect(pageB.getByText(/Item 1 of/i)).toBeVisible({ timeout: 30_000 });

      // ================================================================
      // MEASURE: Presence sync latency
      // ================================================================
      const presenceStart = Date.now();
      const bobAvatar = pageA.locator('.-space-x-2').getByText('BR');
      await expect(bobAvatar).toBeVisible({ timeout: 15_000 });
      timings.presenceSync = Date.now() - presenceStart;

      // ================================================================
      // MEASURE: Text editing sync latency
      // ================================================================
      // Jump to Domain 1 where inline comment fields exist
      await pageA.getByRole('button', { name: /D1\s+\d+\// }).click();
      await pageA.waitForTimeout(500);
      await pageB.getByRole('button', { name: /D1\s+\d+\// }).click();
      await pageB.waitForTimeout(500);

      const commentA = pageA.locator('textarea[placeholder="Add the final reconciled comment..."]');
      await expect(commentA).toBeVisible({ timeout: 10_000 });

      const textSyncStart = Date.now();
      await commentA.fill('Scale test comment');
      const commentB = pageB.locator('textarea[placeholder="Add the final reconciled comment..."]');
      await expect(commentB).toHaveValue('Scale test comment', { timeout: 15_000 });
      timings.textSync = Date.now() - textSyncStart;

      // ================================================================
      // Report and assert
      // ================================================================
      // eslint-disable-next-line no-console
      console.log(
        [
          `--- Scale test timings (${STUDY_COUNT} ROB2 studies, ${STUDY_COUNT * 2} checklists) ---`,
          `  Seed studies:         ${timings.seedStudies}ms`,
          `  Project page load:    ${timings.projectPageLoad}ms`,
          `  Reconcile page load:  ${timings.reconcilePageLoad}ms`,
          `  Presence sync:        ${timings.presenceSync}ms`,
          `  Text editing sync:    ${timings.textSync}ms`,
        ].join('\n'),
      );

      expect(timings.projectPageLoad, 'Project page load too slow').toBeLessThan(
        MAX_PROJECT_LOAD_MS,
      );
      expect(timings.reconcilePageLoad, 'Reconcile page load too slow').toBeLessThan(
        MAX_RECONCILE_LOAD_MS,
      );
      expect(timings.presenceSync, 'Presence sync too slow').toBeLessThan(MAX_PRESENCE_SYNC_MS);
      expect(timings.textSync, 'Text editing sync too slow').toBeLessThan(MAX_TEXT_SYNC_MS);
    } finally {
      await setupCtx.close();
      await contextB.close();
    }
  },
);
