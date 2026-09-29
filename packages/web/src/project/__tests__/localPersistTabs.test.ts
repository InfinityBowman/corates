/**
 * Local practice across tabs: every app tab loads the local rows once and
 * persists them to the same Dexie store, so one tab must never erase what
 * another saved. Each "tab" is a fresh module graph (its own pool and Dexie
 * connection) over one fake IndexedDB.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

const LOCAL = 'local-practice';

async function openTab() {
  vi.resetModules();
  const { connectionPool } = await import('../ConnectionPool');
  const { applyLocalMutation } = await import('../localWrites');
  const { db } = await import('@/primitives/db');
  const entry = connectionPool.acquire(LOCAL)!;
  connectionPool.initializeConnection(LOCAL, entry, { isLocal: true, cancelled: () => false });
  await vi.waitFor(() => expect(connectionPool.getCollections(LOCAL)).toBeTruthy());
  const collections = connectionPool.getCollections(LOCAL)!;
  return {
    db,
    studyIds: () => collections.studies.toArray.map(row => row.id).sort(),
    create(id: string) {
      const now = Date.now();
      applyLocalMutation(LOCAL, 'study.create', { id, name: id, description: '', now });
      applyLocalMutation(LOCAL, 'study.assignReviewers', { id, reviewer1: 'local', now });
      applyLocalMutation(LOCAL, 'checklist.create', {
        id,
        studyId: id,
        type: 'AMSTAR2',
        assignedTo: 'local',
        outcomeId: null,
        now,
      });
    },
    rename(id: string, name: string) {
      applyLocalMutation(LOCAL, 'study.update', { id, updates: { name }, now: Date.now() });
    },
    remove(id: string) {
      applyLocalMutation(LOCAL, 'study.delete', { id });
    },
    /** Await the write chain, as a mutation's persist or a pagehide flush would run. */
    flush: () => connectionPool.flushLocalPersist(),
  };
}

afterEach(async () => {
  const { db } = await import('@/primitives/db');
  await db.localProjects.clear();
});

describe('local practice persistence across tabs', () => {
  it('a stale tab closing does not erase appraisals another tab saved', async () => {
    const older = await openTab();
    older.create('before');
    await older.flush();

    const stale = await openTab();
    const current = await openTab();
    current.create('last-week');
    await current.flush();

    // The stale tab still holds only "before"; closing it fires the pagehide flush.
    expect(stale.studyIds()).toEqual(['before']);
    await stale.flush();

    const reopened = await openTab();
    expect(reopened.studyIds()).toEqual(['before', 'last-week']);
  });

  it('an edit in a stale tab keeps appraisals another tab created', async () => {
    const first = await openTab();
    first.create('before');
    await first.flush();

    const stale = await openTab();
    const current = await openTab();
    current.create('last-week');
    await current.flush();

    stale.rename('before', 'renamed');
    await stale.flush();

    const reopened = await openTab();
    expect(reopened.studyIds()).toEqual(['before', 'last-week']);
    const [study] = (await reopened.db.localProjects.get(LOCAL))!.rows.studies.filter(
      row => (row as { id: string }).id === 'before',
    ) as Array<{ name: string }>;
    expect(study.name).toBe('renamed');
  });

  it('a burst of edits in one tab persists the last one', async () => {
    const tab = await openTab();
    tab.create('study');
    for (let i = 1; i <= 5; i++) tab.rename('study', `name ${i}`);
    await tab.flush();

    const stored = (await tab.db.localProjects.get(LOCAL))!.rows.studies as Array<{
      name: string;
    }>;
    expect(stored.map(row => row.name)).toEqual(['name 5']);
  });

  it('a delete in one tab is not undone by another tab closing', async () => {
    const first = await openTab();
    first.create('keep');
    first.create('drop');
    await first.flush();

    const stale = await openTab();
    const current = await openTab();
    current.remove('drop');
    await current.flush();

    await stale.flush();

    const reopened = await openTab();
    expect(reopened.studyIds()).toEqual(['keep']);
  });
});
