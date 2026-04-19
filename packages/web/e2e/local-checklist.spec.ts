/**
 * E2E Test: Local-practice checklist persistence
 *
 * Local appraisals live in a Y.Doc persisted via y-dexie under the
 * `local-practice` project id (no WebSocket provider). This test verifies
 * that answers round-trip through the full pipeline:
 *   UI patch → handlePartialUpdate → buildChecklistAnswerInput
 *     → updateChecklistAnswer (typed) → handler.updateAnswer
 *     → Y.Map → DexieYProvider → reload → restored state
 *
 * Covers AMSTAR2 (boolean-matrix per question) and ROB2 (discriminated
 * per-key schemas). ROBINS-I shares ROB2's shape-family so we skip it here;
 * the dual-reviewer workflow tests exercise both handlers' typed dispatch
 * via the collab path.
 *
 * No auth needed — /checklist is a public route (see routes/_app.tsx).
 *
 * Prerequisites:
 *   pnpm --filter web dev  (localhost:3010)
 */

import { test, expect } from '@playwright/test';
import { answerAllAMSTAR2, fillROB2Preliminary } from './shared-steps';

async function createLocalChecklist(
  page: import('@playwright/test').Page,
  type: 'AMSTAR2' | 'ROB2' | 'ROBINS_I',
  name: string,
) {
  await page.goto('/checklist');
  await expect(page.getByRole('heading', { name: /Start an Appraisal/i })).toBeVisible({
    timeout: 10_000,
  });

  await page.locator('#checklist-type').selectOption(type);
  await page.locator('#checklist-name').fill(name);
  await page.getByRole('button', { name: /^Start$/ }).click();

  await expect(page).toHaveURL(/\/checklist\/[0-9a-f-]{36}/, { timeout: 10_000 });
  // Wait for the "Loading checklist..." gate to clear (phase === 'synced').
  await expect(page.getByText('Loading checklist...')).toBeHidden({ timeout: 15_000 });
}

test.describe('Local-practice checklists', () => {
  test('AMSTAR2: answers persist across reload', async ({ page }) => {
    await createLocalChecklist(page, 'AMSTAR2', 'Local AMSTAR2 Test');

    await answerAllAMSTAR2(page, 'Yes');

    const checkedBefore = await page.getByRole('radio', { name: 'Yes', checked: true }).count();
    expect(checkedBefore).toBeGreaterThan(0);

    await page.reload();
    await expect(page.getByText('Loading checklist...')).toBeHidden({ timeout: 15_000 });

    // Give the Y.Doc a beat to hydrate from IndexedDB before reading state.
    await page.waitForTimeout(1000);

    const checkedAfter = await page.getByRole('radio', { name: 'Yes', checked: true }).count();
    expect(checkedAfter).toBe(checkedBefore);
  });

  test('ROB2: preliminary fields persist across reload', async ({ page }) => {
    await createLocalChecklist(page, 'ROB2', 'Local ROB2 Test');

    await fillROB2Preliminary(page, 'Drug X', 'Placebo');

    await page.reload();
    await expect(page.getByText('Loading checklist...')).toBeHidden({ timeout: 15_000 });
    await page.waitForTimeout(1000);

    // Y.Text fields round-trip via getTextRef + DexieYProvider.
    await expect(page.getByPlaceholder(/experimental intervention/i)).toHaveValue('Drug X');
    await expect(page.getByPlaceholder(/comparator intervention/i)).toHaveValue('Placebo');
    await expect(page.getByPlaceholder(/e\.g\. RR/i)).toHaveValue('RR 1.5');
  });
});
