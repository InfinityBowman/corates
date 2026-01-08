import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@primitives/db.js';
import {
  saveFormState,
  getFormState,
  clearFormState,
  hasPendingFormState,
  cleanupExpiredStates,
} from '../formStatePersistence.js';

describe('formStatePersistence', () => {
  beforeEach(async () => {
    await db.formStates.clear();
  });

  describe('saveFormState and getFormState', () => {
    it('saves and retrieves form state', async () => {
      const data = { name: 'Test Project', description: 'A description' };

      await saveFormState('createProject', data);

      const result = await getFormState('createProject');
      expect(result).toEqual(data);
    });

    it('saves and retrieves form state with projectId', async () => {
      const data = { studies: ['study-1', 'study-2'] };

      await saveFormState('addStudies', data, 'project-123');

      const result = await getFormState('addStudies', 'project-123');
      expect(result).toEqual(data);
    });

    it('returns null for non-existent form state', async () => {
      const result = await getFormState('createProject');
      expect(result).toBeNull();
    });

    it('overwrites existing form state', async () => {
      await saveFormState('createProject', { name: 'Old' });
      await saveFormState('createProject', { name: 'New' });

      const result = await getFormState('createProject');
      expect(result).toEqual({ name: 'New' });
    });

    it('keeps separate states for different projectIds', async () => {
      await saveFormState('addStudies', { data: 'a' }, 'project-1');
      await saveFormState('addStudies', { data: 'b' }, 'project-2');

      expect(await getFormState('addStudies', 'project-1')).toEqual({ data: 'a' });
      expect(await getFormState('addStudies', 'project-2')).toEqual({ data: 'b' });
    });
  });

  describe('clearFormState', () => {
    it('clears specific form state', async () => {
      await saveFormState('createProject', { name: 'Test' });

      await clearFormState('createProject');

      const result = await getFormState('createProject');
      expect(result).toBeNull();
    });

    it('clears form state with projectId', async () => {
      await saveFormState('addStudies', { data: 'test' }, 'project-123');

      await clearFormState('addStudies', 'project-123');

      expect(await getFormState('addStudies', 'project-123')).toBeNull();
    });
  });

  describe('hasPendingFormState', () => {
    it('returns true when form state exists', async () => {
      await saveFormState('createProject', { name: 'Test' });

      const result = await hasPendingFormState('createProject');
      expect(result).toBe(true);
    });

    it('returns false when form state does not exist', async () => {
      const result = await hasPendingFormState('createProject');
      expect(result).toBe(false);
    });
  });

  describe('cleanupExpiredStates', () => {
    it('removes expired form states', async () => {
      // Insert an expired state directly (25 hours ago)
      const expiredTimestamp = Date.now() - 25 * 60 * 60 * 1000;
      await db.formStates.put({
        key: 'createProject',
        type: 'createProject',
        projectId: null,
        data: { name: 'Expired' },
        timestamp: expiredTimestamp,
      });

      // Insert a fresh state
      await saveFormState('addStudies', { data: 'Fresh' }, 'project-1');

      await cleanupExpiredStates();

      // Expired state should be gone (or return null due to expiry check in getFormState)
      expect(await getFormState('createProject')).toBeNull();
      // Fresh state should remain
      expect(await getFormState('addStudies', 'project-1')).toEqual({ data: 'Fresh' });
    });
  });

  describe('expiry behavior', () => {
    it('returns null for expired form state', async () => {
      // Insert an expired state directly
      const expiredTimestamp = Date.now() - 25 * 60 * 60 * 1000;
      await db.formStates.put({
        key: 'createProject',
        type: 'createProject',
        projectId: null,
        data: { name: 'Expired' },
        timestamp: expiredTimestamp,
      });

      const result = await getFormState('createProject');
      expect(result).toBeNull();
    });
  });
});
