/**
 * Unified Dexie database for CoRATES client-side storage
 *
 * This module provides a single IndexedDB database for all local data:
 * - Local-practice rows (plus the legacy y-dexie Y.Doc they migrated from)
 * - PDF cache for offline access
 *
 * @see packages/docs/plans/dexie-migration.md
 */

import Dexie, { type Table } from 'dexie';
import yDexie from 'y-dexie';
import type { Doc as YDoc } from 'yjs';

// Duplicated from @/project/localProject to avoid a circular import
// (localProject imports from this module).
const LOCAL_PROJECT_ID = 'local-practice';

export interface ProjectRow {
  id: string;
  orgId: string;
  updatedAt: number;
  ydoc: YDoc;
}

interface PdfCacheRow {
  id: string;
  projectId: string;
  studyId: string;
  fileName: string;
  data: ArrayBuffer;
  size: number;
  cachedAt: number;
}

interface AvatarRow {
  userId: string;
  dataUrl: string;
  sourceUrl?: string;
  cachedAt: number;
}

interface FormStateRow {
  key: string;
  type: 'createProject' | 'addStudies';
  projectId: string | null;
  data: unknown;
  timestamp: number;
}

interface LocalChecklistRow {
  id: string;
  name: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

interface LocalChecklistPdfRow {
  checklistId: string;
  data: ArrayBuffer;
  fileName: string;
  updatedAt: number;
}

/** Persisted local-practice rows (post-Y.Doc local data plane). Rows written
 * before outcomes/reconciliations were persisted may lack those keys — the
 * seed path defaults them to empty. */
interface LocalProjectRow {
  id: string;
  updatedAt: number;
  rows: {
    studies: unknown[];
    checklists: unknown[];
    answers: unknown[];
    outcomes?: unknown[];
    reconciliations?: unknown[];
  };
}

/** Projects with an engine sync cache (a `cf-sync:<projectId>` IndexedDB
 * database) on this device. Tracked here because Safari has no
 * `indexedDB.databases()`: wiping the caches on logout or membership
 * revocation needs an enumerable list. Also stamps the project's orgId
 * (immutable) so a cold hard-refresh resolves it without waiting on the
 * network projects query. */
interface SyncCacheRow {
  id: string;
  updatedAt: number;
  orgId?: string;
}

class CoratesDB extends Dexie {
  projects!: Table<ProjectRow, string>;
  localProjects!: Table<LocalProjectRow, string>;
  pdfs!: Table<PdfCacheRow, string>;
  avatars!: Table<AvatarRow, string>;
  formStates!: Table<FormStateRow, string>;
  // TODO(agent): legacy table — kept for one release after the local-practice
  // Y.Doc migration shipped on 2026-04-18 to give all devices a chance to run
  // `migrateLocalChecklistsToYDoc`. Drop the table + the `LocalChecklistRow`
  // type + `migrateLocalChecklistsToYDoc` once the rollback window has passed.
  localChecklists!: Table<LocalChecklistRow, string>;
  localChecklistPdfs!: Table<LocalChecklistPdfRow, string>;
  syncCaches!: Table<SyncCacheRow, string>;

  constructor() {
    super('corates', { addons: [yDexie] });

    this.version(1).stores({
      projects: 'id, orgId, updatedAt, ydoc: Y.Doc',
      pdfs: 'id, projectId, studyId, cachedAt',
      ops: '++id, idempotencyKey, status, createdAt, [status+createdAt]',
      avatars: 'userId, cachedAt',
      formStates: 'key, type, timestamp',
      localChecklists: 'id, createdAt, updatedAt',
      localChecklistPdfs: 'checklistId, updatedAt',
      queryCache: 'key',
    });

    // v2: Remove unused ops table and query cache persistence
    this.version(2).stores({
      ops: null,
      queryCache: null,
    });

    // v3: local practice moves off its Y.Doc onto plain rows (shared sync
    // schema shapes) applied by the shared mutator functions. The `projects`
    // ydoc row survives as the one-time migration source until the end of
    // the sync-engine migration drops it.
    this.version(3).stores({
      localProjects: 'id, updatedAt',
    });

    // v4: track which projects have an engine sync cache so logout/kick can
    // wipe the per-project `cf-sync:*` IndexedDB databases.
    this.version(4).stores({
      syncCaches: 'id, updatedAt',
    });
  }
}

export const db = new CoratesDB();

// Sync-engine cutover cleanup: online projects' y-dexie docs are dead weight
// now — the engine persists its own snapshots in a separate IndexedDB — so
// delete them on every open. The local-practice row is deliberately spared:
// it is the one-time migration source (see loadLegacyLocalRows) and the
// rollback copy until that conversion has soaked, after which a schema
// version drops the `projects` ydoc table and `localChecklists` outright.
db.on('ready', async () => {
  try {
    await db.projects.where('id').notEqual(LOCAL_PROJECT_ID).delete();
  } catch (err) {
    console.warn('Failed to clear legacy y-dexie project state:', err);
  }
});

// The engine's own persistence lives outside Dexie: one `cf-sync:<projectId>`
// IndexedDB database per project plus a `cf-sync:client-id:<projectId>`
// sessionStorage key. Both hold project content / identity and must go when
// access does.
const SYNC_DB_PREFIX = 'cf-sync:';
const SYNC_CLIENT_ID_PREFIX = 'cf-sync:client-id:';

/** Record that a project has an engine sync cache on this device. */
export async function trackSyncCache(projectId: string): Promise<void> {
  const existing = await db.syncCaches.get(projectId);
  await db.syncCaches.put({ ...existing, id: projectId, updatedAt: Date.now() });
}

/** Stamp a project's orgId for cold-refresh resolution (see SyncCacheRow). */
export async function rememberProjectOrgId(projectId: string, orgId: string): Promise<void> {
  const existing = await db.syncCaches.get(projectId);
  await db.syncCaches.put({ updatedAt: Date.now(), ...existing, id: projectId, orgId });
}

export async function getCachedProjectOrgId(projectId: string): Promise<string | null> {
  return (await db.syncCaches.get(projectId))?.orgId ?? null;
}

/**
 * Delete one engine cache database. Resolves on completion, or after a short
 * grace period if an open connection is still blocking deletion — the browser
 * finishes the delete once that connection closes, so an early resolve never
 * leaves the data behind, it only stops logout/kick from hanging on it.
 */
function deleteSyncDatabase(projectId: string): Promise<void> {
  return new Promise(resolve => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    try {
      const request = indexedDB.deleteDatabase(`${SYNC_DB_PREFIX}${projectId}`);
      request.onsuccess = done;
      request.onerror = done;
      setTimeout(done, 2000);
    } catch {
      done();
    }
  });
}

function clearSyncClientId(projectId: string): void {
  try {
    sessionStorage.removeItem(`${SYNC_CLIENT_ID_PREFIX}${encodeURIComponent(projectId)}`);
  } catch {
    /* sessionStorage unavailable */
  }
}

async function removeSyncCache(projectId: string): Promise<void> {
  clearSyncClientId(projectId);
  await deleteSyncDatabase(projectId);
  await db.syncCaches.delete(projectId);
}

/**
 * Delete all data for a specific project
 * Used when user is removed from a project or project is deleted
 */
export async function deleteProjectData(projectId: string): Promise<void> {
  await db.transaction('rw', [db.projects, db.pdfs], async () => {
    await db.projects.delete(projectId);
    await db.pdfs.where('projectId').equals(projectId).delete();
  });
  await removeSyncCache(projectId);
}

/**
 * Clear all local data (e.g., on logout)
 * Note: localChecklists and localChecklistPdfs are intentionally NOT cleared
 * as they are user's local practice data not tied to authentication.
 * The local-practice Y.Doc row in `projects` is preserved for the same reason.
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.projects, db.pdfs, db.avatars, db.formStates], async () => {
    await db.projects.where('id').notEqual(LOCAL_PROJECT_ID).delete();
    await db.pdfs.clear();
    await db.avatars.clear();
    await db.formStates.clear();
  });

  // Engine caches: every tracked project, in parallel; the tracked list is
  // the authority (Safari cannot enumerate databases). Clear every client-id
  // key too so the next login in this tab mints a fresh mutation identity.
  const tracked = await db.syncCaches.toArray();
  await Promise.all(tracked.map(row => removeSyncCache(row.id)));
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(SYNC_CLIENT_ID_PREFIX)) sessionStorage.removeItem(key);
    }
  } catch {
    /* sessionStorage unavailable */
  }
}
