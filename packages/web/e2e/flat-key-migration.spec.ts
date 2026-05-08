/**
 * E2E Test: Nested-to-flat Y.Map migration for checklist answers
 *
 * Verifies that old nested-format Y.Doc data (pre-2026-05-02) is automatically
 * migrated to flat dot-notation keys when a project is loaded. The migration
 * runs in ConnectionPool after DexieYProvider loads persisted state.
 *
 * Strategy:
 *   1. Create a local checklist and answer questions via the UI
 *   2. Rewrite the answers Y.Map to old nested format via page.evaluate
 *   3. Reload -- migration runs on the DexieYProvider's persisted state
 *   4. Verify answers still display correctly
 *
 * Uses the dev-mode window.__connectionPool and window.__Y exposures.
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
 * Rewrite a local checklist's flat-key answers to old nested Y.Map format.
 * Simulates a production Y.Doc created before the flat-key migration.
 */
async function rewriteAMSTAR2ToNested(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const pool = (window as any).__connectionPool;
    const Y = (window as any).__Y;
    if (!pool || !Y) throw new Error('Dev-mode globals not available');

    const entry = pool.getEntry('local-practice');
    if (!entry) throw new Error('No local-practice connection entry');

    const ydoc = entry.ydoc;
    const checklistId = window.location.pathname.split('/').pop()!;
    const study = ydoc.getMap('reviews').get(checklistId) as any;
    const answersMap = study.get('checklists').get(checklistId).get('answers') as any;

    ydoc.transact(() => {
      // Group flat keys by question prefix
      const grouped: Record<string, Record<string, any>> = {};
      for (const [key, value] of answersMap.entries()) {
        const dotIdx = key.indexOf('.');
        if (dotIdx === -1) continue;
        const prefix = key.substring(0, dotIdx);
        const field = key.substring(dotIdx + 1);
        if (!grouped[prefix]) grouped[prefix] = {};
        grouped[prefix][field] = value;
      }

      // Clear all flat keys
      for (const key of [...answersMap.keys()]) {
        answersMap.delete(key);
      }

      // Recreate as nested Y.Maps (old format)
      for (const [qKey, fields] of Object.entries(grouped)) {
        const qMap = new Y.Map();
        if (fields.answers !== undefined) qMap.set('answers', fields.answers);
        if (fields.critical !== undefined) qMap.set('critical', fields.critical);
        qMap.set('note', new Y.Text());
        answersMap.set(qKey, qMap);
      }
    });
  });
}

async function rewriteROB2ToNested(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const pool = (window as any).__connectionPool;
    const Y = (window as any).__Y;
    if (!pool || !Y) throw new Error('Dev-mode globals not available');

    const entry = pool.getEntry('local-practice');
    const ydoc = entry.ydoc;
    const checklistId = window.location.pathname.split('/').pop()!;
    const study = ydoc.getMap('reviews').get(checklistId) as any;
    const answersMap = study.get('checklists').get(checklistId).get('answers') as any;

    const entries: [string, any][] = [...answersMap.entries()];

    ydoc.transact(() => {
      for (const key of [...answersMap.keys()]) {
        answersMap.delete(key);
      }

      // Build nested preliminary
      const preliminary = new Y.Map();
      for (const [key, value] of entries) {
        if (!key.startsWith('preliminary.')) continue;
        const field = key.substring('preliminary.'.length);
        if (value instanceof Y.Text) {
          preliminary.set(field, new Y.Text());
        } else {
          preliminary.set(field, value);
        }
      }
      answersMap.set('preliminary', preliminary);

      // Build nested domains
      const domainAnswers: Record<string, Record<string, Record<string, any>>> = {};
      const domainMeta: Record<string, Record<string, any>> = {};

      for (const [key, value] of entries) {
        if (key.startsWith('preliminary.') || key.startsWith('overall.')) continue;

        const dotIdx = key.indexOf('.');
        if (dotIdx === -1) {
          // Bare question key like "d1_1"
          const match = key.match(/^d(\d+[a-z]?)_/);
          if (match) {
            const domain = `domain${match[1]}`;
            if (!domainAnswers[domain]) domainAnswers[domain] = {};
            if (!domainAnswers[domain][key]) domainAnswers[domain][key] = {};
            domainAnswers[domain][key].answer = value;
          }
        } else {
          const prefix = key.substring(0, dotIdx);
          const field = key.substring(dotIdx + 1);
          if (prefix.startsWith('domain')) {
            if (!domainMeta[prefix]) domainMeta[prefix] = {};
            domainMeta[prefix][field] = value;
          } else {
            // Question comment like "d1_1.comment"
            const match = prefix.match(/^d(\d+[a-z]?)_/);
            if (match) {
              const domain = `domain${match[1]}`;
              if (!domainAnswers[domain]) domainAnswers[domain] = {};
              if (!domainAnswers[domain][prefix]) domainAnswers[domain][prefix] = {};
              domainAnswers[domain][prefix][field] = true;
            }
          }
        }
      }

      const allDomains = new Set([...Object.keys(domainAnswers), ...Object.keys(domainMeta)]);
      for (const domain of allDomains) {
        const domainYMap = new Y.Map();
        const meta = domainMeta[domain] || {};
        if (meta.direction !== undefined) domainYMap.set('direction', meta.direction);

        const answersNested = new Y.Map();
        const qas = domainAnswers[domain] || {};
        for (const [qKey, qVal] of Object.entries(qas)) {
          const qYMap = new Y.Map();
          if (qVal.answer !== undefined) qYMap.set('answer', qVal.answer);
          qYMap.set('comment', new Y.Text());
          answersNested.set(qKey, qYMap);
        }
        domainYMap.set('answers', answersNested);
        answersMap.set(domain, domainYMap);
      }

      // Overall
      const overallDirection = entries.find(([k]) => k === 'overall.direction');
      if (overallDirection) {
        const overall = new Y.Map();
        overall.set('direction', overallDirection[1]);
        answersMap.set('overall', overall);
      }
    });
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

    // Allow DexieYProvider to persist
    await page.waitForTimeout(1000);

    // Rewrite answers to old nested format
    await rewriteAMSTAR2ToNested(page);

    // Allow persistence of the nested format
    await page.waitForTimeout(1000);

    // Reload -- migrateYDocToFlatKeys runs in ConnectionPool
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

    // Rewrite to nested format (Y.Text content is lost in the rewrite since
    // we create new instances, but structural data like study design, aim,
    // and signalling question answers preserve their primitive values)
    await rewriteROB2ToNested(page);
    await page.waitForTimeout(1000);

    // Reload -- migration runs
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
