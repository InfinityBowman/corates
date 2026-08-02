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

/**
 * Delete all data for a specific project
 * Used when user is removed from a project or project is deleted
 */
export async function deleteProjectData(projectId: string): Promise<void> {
  await db.transaction('rw', [db.projects, db.pdfs], async () => {
    await db.projects.delete(projectId);
    await db.pdfs.where('projectId').equals(projectId).delete();
  });
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
}
