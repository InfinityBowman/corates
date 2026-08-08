/**
 * E2E Test: legacy local-practice data migrates on load
 *
 * Verifies the one-time ydoc→rows converter (`loadLegacyLocalRows`) — the
 * path a device with pre-cutover local data takes on its first load of the
 * new bundle, including the nested→flat answer migration for docs untouched
 * since before 2026-05.
 *
 * Strategy:
 *   1. Create a local checklist and answer questions via the UI (row plane)
 *   2. Rewrite the rows into a legacy NESTED Y.Doc in Dexie and delete the
 *      row store (window.__devLegacy, behind VITE_DEV_PANEL)
 *   3. Reload — the converter runs: DexieYProvider load → flat-key migration
 *      → rows
 *   4. Verify answers still display correctly
 *
 * Prerequisites:
 *   pnpm --filter web dev  (localhost:3010)
 */

import { test, expect } from '@playwright/test';
import { answerAllAMSTAR2, fillROB2Preliminary } from './shared-steps';

const TYPE_LABELS: Record<string, string> = {
  AMSTAR2: 'AMSTAR 2',
  ROB2: 'RoB 2',
};

async function createLocalChecklist(
  page: import('@playwright/test').Page,
  type: 'AMSTAR2' | 'ROB2',
  name: string,
) {
  await page.goto('/checklist');
  await expect(page.getByRole('heading', { name: /Start an Appraisal/i })).toBeVisible({
    timeout: 10_000,
  });

  await page.locator('#checklist-type').click();
  await page.getByRole('option', { name: new RegExp(TYPE_LABELS[type]) }).click();
  await page.locator('#checklist-name').fill(name);
  await page.getByRole('button', { name: /^Start$/ }).click();

  await expect(page).toHaveURL(/\/checklist\/[0-9a-f-]{36}/, { timeout: 10_000 });
  await expect(page.getByText('Loading checklist...')).toBeHidden({ timeout: 15_000 });
}

/**
 * Rewrite the current local-practice rows into a legacy nested Y.Doc and
 * drop the row store, so the reload takes the one-time converter path.
 */
async function rewriteToLegacyDoc(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    const legacy = (
      window as unknown as {
        __devLegacy?: { rewriteLocalRowsToLegacyDoc: () => Promise<void> };
      }
    ).__devLegacy;
    if (!legacy) throw new Error('Dev-mode globals not available');
    await legacy.rewriteLocalRowsToLegacyDoc();
  });
}

const isRemote = !!process.env.PLAYWRIGHT_BASE_URL;

test.describe('Flat-key migration', () => {
  test.skip(isRemote, 'Requires dev-mode browser globals only available in local dev server');
  test('AMSTAR2: nested answers are migrated and display correctly after reload', async ({
    page,
  }) => {
    await createLocalChecklist(page, 'AMSTAR2', 'Migration Test AMSTAR2');

    await answerAllAMSTAR2(page, 'Yes');
    const checkedBefore = await page.getByRole('radio', { name: 'Yes', checked: true }).count();
    expect(checkedBefore).toBeGreaterThan(0);

    // Rewrite the rows into a legacy nested Y.Doc (flushes rows itself)
    await rewriteToLegacyDoc(page);

    // Reload -- the one-time converter (incl. flat-key migration) runs
    await page.reload();
    await expect(page.getByText('Loading checklist...')).toBeHidden({ timeout: 15_000 });

    // All Yes answers should survive the nested -> flat migration
    await expect(async () => {
      const checkedAfter = await page.getByRole('radio', { name: 'Yes', checked: true }).count();
      expect(checkedAfter).toBe(checkedBefore);
    }).toPass({ timeout: 10_000 });
  });

  test('ROB2: nested preliminary and domain answers migrate correctly', async ({ page }) => {
    await createLocalChecklist(page, 'ROB2', 'Migration Test ROB2');

    await fillROB2Preliminary(page, 'Drug X', 'Placebo');

    // Select some domain answers
    await page.getByRole('button', { name: 'D1', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Y', exact: true }).first()).toBeVisible({
      timeout: 5_000,
    });
    const yButtons = page.getByRole('button', { name: 'Y', exact: true });
    const d1Count = await yButtons.count();
    for (let i = 0; i < d1Count; i++) {
      await yButtons.nth(i).click();
      await page.waitForTimeout(50);
    }

    await page.waitForTimeout(1000);

    // Count selected answers before rewrite
    const selectedBefore = await countSelectedToggleButtons(page, 'Y');

    // Rewrite the rows into a legacy nested Y.Doc, then reload -- the
    // one-time converter (incl. flat-key migration) runs
    await rewriteToLegacyDoc(page);
    await page.reload();
    await expect(page.getByText('Loading checklist...')).toBeHidden({ timeout: 15_000 });

    // The form should render without errors
    await expect(page.getByRole('button', { name: 'D1', exact: true })).toBeVisible({
      timeout: 10_000,
    });

    // Navigate to D1 and verify signalling question answers survived
    await page.getByRole('button', { name: 'D1', exact: true }).click();
    await expect(async () => {
      const selected = await countSelectedToggleButtons(page, 'Y');
      expect(selected).toBe(selectedBefore);
    }).toPass({ timeout: 10_000 });

    // Verify preliminary scalar fields survived (study design radio)
    const studyDesignRadio = page.getByText('Individually-randomized parallel-group trial');
    await expect(studyDesignRadio).toBeVisible();
  });
});

async function countSelectedToggleButtons(
  page: import('@playwright/test').Page,
  name: string,
): Promise<number> {
  const buttons = page.getByRole('button', { name, exact: true });
  const count = await buttons.count();
  let selected = 0;
  for (let i = 0; i < count; i++) {
    const ariaPressed = await buttons.nth(i).getAttribute('aria-pressed');
    const dataState = await buttons.nth(i).getAttribute('data-state');
    if (ariaPressed === 'true' || dataState === 'on') selected++;
  }
  return selected;
}
