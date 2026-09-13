/**
 * E2E Test: local-practice rows persisted by an older build migrate on load
 *
 * A device that used local practice before the schema stamp existed holds a
 * `localProjects` row with no `schemaVersion`, checklists without `kind`,
 * a null assignee, and no plan rows. On the next load the pool must replay
 * the shared schema migrations over it (`migrateLocalRows`), give the
 * practice study its single reviewer, and restamp, without losing answers.
 *
 * Strategy:
 *   1. Create a local checklist and answer questions via the UI
 *   2. Rewrite the Dexie row to the pre-stamp shape with raw IndexedDB
 *   3. Reload and verify the answers display and the row is at the current
 *      schema with the single-reviewer shape
 *
 * Prerequisites:
 *   pnpm --filter web dev  (localhost:3010)
 */

import { test, expect } from './test';
import { answerAllAMSTAR2 } from './shared-steps';

const LOCAL_PROJECT_ID = 'local-practice';

interface StoredLocalProject {
  id: string;
  updatedAt: number;
  schemaVersion?: number;
  rows: Record<string, Array<Record<string, unknown>>>;
}

async function readLocalProject(page: import('@playwright/test').Page) {
  return page.evaluate(async (id): Promise<StoredLocalProject | undefined> => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('corates');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const store = db.transaction('localProjects', 'readonly').objectStore('localProjects');
      return await new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }, LOCAL_PROJECT_ID);
}

/** Strip everything the schema stamp era added, as an older build would have written it. */
async function rewriteToUnstampedRow(page: import('@playwright/test').Page) {
  await page.evaluate(async id => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('corates');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const tx = db.transaction('localProjects', 'readwrite');
      const store = tx.objectStore('localProjects');
      const stored = await new Promise<StoredLocalProject>((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!stored) throw new Error('no local project row to rewrite');
      delete stored.schemaVersion;
      delete stored.rows.appraisals;
      stored.rows.studies = stored.rows.studies.map(({ reviewer1: _r1, ...study }) => study);
      stored.rows.checklists = stored.rows.checklists.map(({ kind: _kind, ...checklist }) => ({
        ...checklist,
        assignedTo: null,
      }));
      store.put(stored);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }, LOCAL_PROJECT_ID);
}

test.describe('Local-practice schema upgrade', () => {
  test('an unstamped row migrates on load and keeps its answers', async ({ page }) => {
    await page.goto('/checklist');
    await expect(page.getByRole('heading', { name: /Start an Appraisal/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('#checklist-type').click();
    await page.getByRole('option', { name: /AMSTAR 2/ }).click();
    await page.locator('#checklist-name').fill('Upgrade Test');
    await page.getByRole('button', { name: /^Start$/ }).click();
    await expect(page).toHaveURL(/\/checklist\/[0-9a-f-]{36}/, { timeout: 10_000 });
    await expect(page.getByText('Loading checklist...')).toBeHidden({ timeout: 15_000 });

    await answerAllAMSTAR2(page, 'Yes');
    const checkedBefore = await page.getByRole('radio', { name: 'Yes', checked: true }).count();
    expect(checkedBefore).toBeGreaterThan(0);

    // Let the pool's per-mutation persist land, then rewrite the row.
    let stampedVersion: number | undefined;
    await expect(async () => {
      const stored = await readLocalProject(page);
      expect(stored?.schemaVersion).toBeGreaterThan(1);
      expect(stored?.rows.answers.length).toBeGreaterThan(0);
      stampedVersion = stored?.schemaVersion;
    }).toPass({ timeout: 10_000 });
    await rewriteToUnstampedRow(page);
    const before = await readLocalProject(page);
    expect(before?.schemaVersion).toBeUndefined();
    expect(before?.rows.checklists[0]).not.toHaveProperty('kind');

    await page.reload();
    await expect(page.getByText('Loading checklist...')).toBeHidden({ timeout: 15_000 });
    await expect(async () => {
      const checkedAfter = await page.getByRole('radio', { name: 'Yes', checked: true }).count();
      expect(checkedAfter).toBe(checkedBefore);
    }).toPass({ timeout: 10_000 });

    const after = await readLocalProject(page);
    expect(after?.schemaVersion).toBe(stampedVersion);
    expect(after?.rows.studies[0]).toMatchObject({ reviewer1: 'local' });
    expect(after?.rows.checklists).toHaveLength(1);
    expect(after?.rows.checklists[0]).toMatchObject({ kind: 'reviewer', assignedTo: 'local' });
    expect(after?.rows.appraisals).toHaveLength(1);
  });
});
