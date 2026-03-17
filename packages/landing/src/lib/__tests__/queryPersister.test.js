import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@/primitives/db.js';
import { createIDBPersister } from '../queryPersister';

describe('queryPersister', () => {
  beforeEach(async () => {
    await db.queryCache.clear();
  });

  describe('persistClient', () => {
    it('persists client state', async () => {
      const persister = createIDBPersister();
      const clientState = {
        timestamp: Date.now(),
        buster: 'test',
        clientState: {
          queries: [{ queryKey: ['test'], state: { data: 'hello' } }],
          mutations: [],
        },
      };

      await persister.persistClient(clientState);

      const record = await db.queryCache.get('queryClient');
      expect(record).toBeDefined();
      expect(record.data).toEqual(clientState);
    });
  });

  describe('restoreClient', () => {
    it('restores persisted client state', async () => {
      const persister = createIDBPersister();
      const clientState = {
        timestamp: Date.now(),
        clientState: { queries: [], mutations: [] },
      };

      await persister.persistClient(clientState);
      const restored = await persister.restoreClient();

      expect(restored).toEqual(clientState);
    });

    it('returns null when no state persisted', async () => {
      const persister = createIDBPersister();

      const restored = await persister.restoreClient();

      expect(restored).toBeNull();
    });
  });

  describe('removeClient', () => {
    it('removes persisted client state', async () => {
      const persister = createIDBPersister();
      await persister.persistClient({ test: 'data' });

      await persister.removeClient();

      const restored = await persister.restoreClient();
      expect(restored).toBeNull();
    });
  });
});
