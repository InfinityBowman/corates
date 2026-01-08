/**
 * TanStack Query Dexie Persister
 *
 * Persists query cache to Dexie for local-first offline support.
 */

import { db } from '@primitives/db.js';

const CACHE_KEY = 'queryClient';

/**
 * Create a Dexie persister for TanStack Query
 * Implements the persister interface expected by TanStack Query
 * @returns {Object} Persister object with persistClient, restoreClient, removeClient methods
 */
export function createIDBPersister() {
  return {
    /**
     * Persist query client state to Dexie
     * @param {Object} client - The persisted client state
     */
    persistClient: async client => {
      try {
        await db.queryCache.put({ key: CACHE_KEY, data: client });
      } catch (error) {
        console.error('Failed to persist query client to Dexie:', error);
      }
    },

    /**
     * Restore query client state from Dexie
     * @returns {Promise<Object|null>} The persisted client state or null
     */
    restoreClient: async () => {
      try {
        const record = await db.queryCache.get(CACHE_KEY);
        return record?.data || null;
      } catch (error) {
        console.error('Failed to restore query client from Dexie:', error);
        return null;
      }
    },

    /**
     * Remove persisted query client state from Dexie
     */
    removeClient: async () => {
      try {
        await db.queryCache.delete(CACHE_KEY);
      } catch (error) {
        console.error('Failed to remove query client from Dexie:', error);
      }
    },
  };
}
