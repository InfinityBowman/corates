/**
 * Unified Dexie database for CoRATES client-side storage
 *
 * This module provides a single IndexedDB database for all local data:
 * - Project Y.Doc persistence (via y-dexie)
 * - PDF cache for offline access
 * - Operation queue for offline mutations
 *
 * @see packages/docs/plans/dexie-migration.md
 */

import Dexie from 'dexie';
import yDexie from 'y-dexie';

/**
 * @typedef {import('yjs').Doc} YDoc
 */

/**
 * Project row with Y.Doc for collaborative data
 * @typedef {Object} ProjectRow
 * @property {string} id - Project ID (primary key)
 * @property {string} orgId - Organization ID
 * @property {number} updatedAt - Last update timestamp
 * @property {YDoc} ydoc - Y.Doc for project collaborative data
 */

/**
 * PDF cache entry
 * @typedef {Object} PdfCacheRow
 * @property {string} id - Composite key: projectId:studyId:fileName
 * @property {string} projectId - Project ID
 * @property {string} studyId - Study ID
 * @property {string} fileName - PDF file name
 * @property {ArrayBuffer} data - PDF binary data
 * @property {number} size - Size in bytes
 * @property {number} cachedAt - Cache timestamp
 */

/**
 * Operation queue entry for offline mutations
 * @typedef {Object} OpQueueRow
 * @property {number} [id] - Auto-incremented ID
 * @property {string} idempotencyKey - Unique key for server replay
 * @property {string} endpoint - API endpoint
 * @property {unknown} payload - Operation payload
 * @property {'pending'|'syncing'|'applied'|'failed'} status - Operation status
 * @property {number} createdAt - Creation timestamp
 * @property {number} attempts - Number of sync attempts
 * @property {number} [lastAttempt] - Last attempt timestamp
 * @property {string} [error] - Error message if failed
 */

/**
 * Avatar cache entry
 * @typedef {Object} AvatarRow
 * @property {string} userId - User ID (primary key)
 * @property {string} dataUrl - Base64 data URL of avatar image
 * @property {string} [sourceUrl] - Original URL used to fetch avatar (for change detection)
 * @property {number} cachedAt - Cache timestamp
 */

/**
 * Form state persistence entry (for OAuth redirect preservation)
 * @typedef {Object} FormStateRow
 * @property {string} key - Storage key (type or type:projectId)
 * @property {'createProject'|'addStudies'} type - Form type
 * @property {string|null} projectId - Associated project ID (for addStudies)
 * @property {unknown} data - Serialized form data
 * @property {number} timestamp - Save timestamp
 */

/**
 * Local checklist entry (for offline practice mode)
 * @typedef {Object} LocalChecklistRow
 * @property {string} id - Checklist ID (local-{uuid})
 * @property {string} name - Checklist name
 * @property {string} type - Checklist type (AMSTAR2, ROBINS-I, etc.)
 * @property {Object} data - Checklist data
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Last update timestamp
 */

/**
 * Local checklist PDF entry
 * @typedef {Object} LocalChecklistPdfRow
 * @property {string} checklistId - Associated checklist ID (primary key)
 * @property {ArrayBuffer} data - PDF binary data
 * @property {string} fileName - Original file name
 * @property {number} updatedAt - Last update timestamp
 */

/**
 * TanStack Query cache entry
 * @typedef {Object} QueryCacheRow
 * @property {string} key - Cache key (primary key)
 * @property {unknown} data - Serialized query client state
 */

/**
 * CoRATES unified database
 * @extends Dexie
 */
class CoratesDB extends Dexie {
  /** @type {Dexie.Table<ProjectRow, string>} */
  projects;

  /** @type {Dexie.Table<PdfCacheRow, string>} */
  pdfs;

  /** @type {Dexie.Table<OpQueueRow, number>} */
  ops;

  /** @type {Dexie.Table<AvatarRow, string>} */
  avatars;

  /** @type {Dexie.Table<FormStateRow, string>} */
  formStates;

  /** @type {Dexie.Table<LocalChecklistRow, string>} */
  localChecklists;

  /** @type {Dexie.Table<LocalChecklistPdfRow, string>} */
  localChecklistPdfs;

  /** @type {Dexie.Table<QueryCacheRow, string>} */
  queryCache;

  constructor() {
    super('corates', { addons: [yDexie] });

    this.version(1).stores({
      // Y.Doc stored as 'ydoc' property via y-dexie
      projects: 'id, orgId, updatedAt, ydoc: Y.Doc',
      // PDF cache with LRU eviction by cachedAt
      pdfs: 'id, projectId, studyId, cachedAt',
      // Operation queue with compound index for efficient pending queries
      ops: '++id, idempotencyKey, status, createdAt, [status+createdAt]',
      // Avatar cache with expiry by cachedAt
      avatars: 'userId, cachedAt',
      // Form state persistence for OAuth redirects
      formStates: 'key, type, timestamp',
      // Local checklists for offline practice
      localChecklists: 'id, createdAt, updatedAt',
      // PDFs associated with local checklists
      localChecklistPdfs: 'checklistId, updatedAt',
      // TanStack Query cache persistence
      queryCache: 'key',
    });
  }
}

/**
 * Singleton database instance
 * @type {CoratesDB}
 */
export const db = new CoratesDB();

/**
 * Delete all data for a specific project
 * Used when user is removed from a project or project is deleted
 * @param {string} projectId - Project ID to clean up
 */
export async function deleteProjectData(projectId) {
  await db.transaction('rw', [db.projects, db.pdfs], async () => {
    await db.projects.delete(projectId);
    await db.pdfs.where('projectId').equals(projectId).delete();
  });
}

/**
 * Clear all local data (e.g., on logout)
 * Note: localChecklists and localChecklistPdfs are intentionally NOT cleared
 * as they are user's local practice data not tied to authentication
 */
export async function clearAllData() {
  await db.transaction(
    'rw',
    [db.projects, db.pdfs, db.ops, db.avatars, db.formStates, db.queryCache],
    async () => {
      await db.projects.clear();
      await db.pdfs.clear();
      await db.ops.clear();
      await db.avatars.clear();
      await db.formStates.clear();
      await db.queryCache.clear();
    },
  );
}
