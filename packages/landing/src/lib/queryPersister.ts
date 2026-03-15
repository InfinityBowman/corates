/**
 * TanStack Query Dexie Persister
 *
 * Persists query cache to Dexie for local-first offline support.
 */

import { db } from '@/primitives/db.js';

const CACHE_KEY = 'queryClient';

export interface IDBPersister {
  persistClient: (_client: unknown) => Promise<void>;
  restoreClient: () => Promise<unknown | null>;
  removeClient: () => Promise<void>;
}

export function createIDBPersister(): IDBPersister {
  return {
    persistClient: async (client: unknown) => {
      try {
        await (db as any).queryCache.put({ key: CACHE_KEY, data: client });
      } catch (error) {
        console.error('Failed to persist query client to Dexie:', error);
      }
    },

    restoreClient: async () => {
      try {
        const record = await (db as any).queryCache.get(CACHE_KEY);
        return record?.data || null;
      } catch (error) {
        console.error('Failed to restore query client from Dexie:', error);
        return null;
      }
    },

    removeClient: async () => {
      try {
        await (db as any).queryCache.delete(CACHE_KEY);
      } catch (error) {
        console.error('Failed to remove query client from Dexie:', error);
      }
    },
  };
}
