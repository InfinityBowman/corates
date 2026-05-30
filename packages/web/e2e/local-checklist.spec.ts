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

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { answerAllAMSTAR2, fillROB2Preliminary } from './shared-steps';

const FIXTURES_DIR = path.join(import.meta.dirname, 'fixtures');

const TYPE_LABELS: Record<string, string> = {
  AMSTAR2: 'AMSTAR 2',
  ROB2: 'RoB 2',
  ROBINS_I: 'ROBINS-I V2',
};

async function createLocalChecklist(
  page: import('@playwright/test').Page,
  type: 'AMSTAR2' | 'ROB2' | 'ROBINS_I',
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

    await expect(async () => {
      const checkedAfter = await page.getByRole('radio', { name: 'Yes', checked: true }).count();
      expect(checkedAfter).toBe(checkedBefore);
    }).toPass({ timeout: 10_000 });
  });

  test('ROB2: preliminary fields persist across reload', async ({ page }) => {
    await createLocalChecklist(page, 'ROB2', 'Local ROB2 Test');

    await fillROB2Preliminary(page, 'Drug X', 'Placebo');

    await page.reload();
    await expect(page.getByText('Loading checklist...')).toBeHidden({ timeout: 15_000 });

    // Y.Text fields round-trip via getTextRef + DexieYProvider.
    await expect(page.getByPlaceholder(/experimental intervention/i)).toHaveValue('Drug X');
    await expect(page.getByPlaceholder(/comparator intervention/i)).toHaveValue('Placebo');
    await expect(page.getByPlaceholder(/e\.g\. RR/i)).toHaveValue('RR 1.5');
  });

  test('upload PDF dropzone appears when no PDF attached', async ({ page }) => {
    await createLocalChecklist(page, 'AMSTAR2', 'No-PDF Upload Test');

    const dropzone = page.getByText('Click to upload');
    await expect(dropzone).toBeVisible({ timeout: 10_000 });

    const fileInput = page.locator('input[type="file"][accept*="pdf"]');
    await fileInput.setInputFiles(path.join(FIXTURES_DIR, 'Petrie2019.pdf'));

    // Dropzone should disappear once the PDF loads
    await expect(dropzone).toBeHidden({ timeout: 15_000 });
  });
});
