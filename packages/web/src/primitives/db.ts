/**
 * Unified Dexie database for CoRATES client-side storage
 *
 * This module provides a single IndexedDB database for all local data:
 * - Project Y.Doc persistence (via y-dexie)
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

class CoratesDB extends Dexie {
  projects!: Table<ProjectRow, string>;
  pdfs!: Table<PdfCacheRow, string>;
  avatars!: Table<AvatarRow, string>;
  formStates!: Table<FormStateRow, string>;
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
  }
}

export const db = new CoratesDB();

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
