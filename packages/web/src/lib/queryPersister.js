/**
 * TanStack Query IndexedDB Persister
 *
 * Persists query cache to IndexedDB for local-first offline support.
 */

import { openDB } from 'idb';

const DB_NAME = 'corates-query-cache';
const DB_VERSION = 1;
const STORE_NAME = 'queryCache';
const CACHE_KEY = 'queryClient';

// Shared database instance promise
let dbPromise = null;

/**
 * Get or create the IndexedDB database
 */
function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Create an IndexedDB persister for TanStack Query
 * Implements the persister interface expected by TanStack Query
 * @returns {Object} Persister object with persistClient, restoreClient, removeClient methods
 */
export function createIDBPersister() {
  return {
    /**
     * Persist query client state to IndexedDB
     * @param {Object} client - The persisted client state
     */
    persistClient: async client => {
      try {
        const db = await getDB();
        await db.put(STORE_NAME, client, CACHE_KEY);
      } catch (error) {
        console.error('Failed to persist query client to IndexedDB:', error);
      }
    },

    /**
     * Restore query client state from IndexedDB
     * @returns {Promise<Object|null>} The persisted client state or null
     */
    restoreClient: async () => {
      try {
        const db = await getDB();
        const client = await db.get(STORE_NAME, CACHE_KEY);
        return client || null;
      } catch (error) {
        console.error('Failed to restore query client from IndexedDB:', error);
        return null;
      }
    },

    /**
     * Remove persisted query client state from IndexedDB
     */
    removeClient: async () => {
      try {
        const db = await getDB();
        await db.delete(STORE_NAME, CACHE_KEY);
      } catch (error) {
        console.error('Failed to remove query client from IndexedDB:', error);
      }
    },
  };
}
