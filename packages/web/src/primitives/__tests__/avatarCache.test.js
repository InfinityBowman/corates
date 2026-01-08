import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db.js';
import {
  getCachedAvatar,
  cacheAvatar,
  removeCachedAvatar,
  clearAvatarCache,
  pruneExpiredAvatars,
} from '../avatarCache.js';

describe('avatarCache', () => {
  beforeEach(async () => {
    await db.avatars.clear();
  });

  describe('cacheAvatar and getCachedAvatar', () => {
    it('caches and retrieves avatar', async () => {
      const dataUrl = 'data:image/png;base64,abc123';

      await cacheAvatar('user-1', dataUrl);

      const result = await getCachedAvatar('user-1');
      expect(result).toBe(dataUrl);
    });

    it('returns null for non-existent user', async () => {
      const result = await getCachedAvatar('nonexistent');
      expect(result).toBeNull();
    });

    it('returns null for null/undefined userId', async () => {
      expect(await getCachedAvatar(null)).toBeNull();
      expect(await getCachedAvatar(undefined)).toBeNull();
    });

    it('overwrites existing avatar', async () => {
      await cacheAvatar('user-1', 'data:image/png;base64,old');
      await cacheAvatar('user-1', 'data:image/png;base64,new');

      const result = await getCachedAvatar('user-1');
      expect(result).toBe('data:image/png;base64,new');
    });
  });

  describe('removeCachedAvatar', () => {
    it('removes a cached avatar', async () => {
      await cacheAvatar('user-1', 'data:image/png;base64,abc');

      await removeCachedAvatar('user-1');

      const result = await getCachedAvatar('user-1');
      expect(result).toBeNull();
    });

    it('handles removing non-existent avatar gracefully', async () => {
      await removeCachedAvatar('nonexistent');
    });
  });

  describe('clearAvatarCache', () => {
    it('clears all cached avatars', async () => {
      await cacheAvatar('user-1', 'data:image/png;base64,a');
      await cacheAvatar('user-2', 'data:image/png;base64,b');

      await clearAvatarCache();

      expect(await getCachedAvatar('user-1')).toBeNull();
      expect(await getCachedAvatar('user-2')).toBeNull();
    });
  });

  describe('pruneExpiredAvatars', () => {
    it('removes expired avatars', async () => {
      // Insert an "expired" avatar directly
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
      await db.avatars.put({
        userId: 'old-user',
        dataUrl: 'data:image/png;base64,old',
        cachedAt: thirtyOneDaysAgo,
      });

      // Insert a fresh avatar
      await cacheAvatar('new-user', 'data:image/png;base64,new');

      await pruneExpiredAvatars();

      expect(await getCachedAvatar('old-user')).toBeNull();
      expect(await getCachedAvatar('new-user')).toBe('data:image/png;base64,new');
    });
  });
});
