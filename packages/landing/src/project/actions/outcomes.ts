/**
 * Outcome actions -- create, update, delete project-level outcomes
 */

import { useAuthStore, selectUser } from '@/stores/authStore';
import { connectionPool } from '../ConnectionPool';

export const outcomeActions = {
  create(name: string): string | null {
    const conn = connectionPool.getActiveOps();
    if (!conn?.createOutcome) {
      console.error('[outcome.create] No connection');
      return null;
    }
    const user = selectUser(useAuthStore.getState());
    if (!user?.id) {
      console.error('[outcome.create] No user logged in');
      return null;
    }
    return conn.createOutcome(name, user.id);
  },

  update(outcomeId: string, name: string): boolean {
    const conn = connectionPool.getActiveOps();
    if (!conn?.updateOutcome) {
      console.error('[outcome.update] No connection');
      return false;
    }
    return conn.updateOutcome(outcomeId, name);
  },

  delete(outcomeId: string): { success: boolean; error?: string } {
    const conn = connectionPool.getActiveOps();
    if (!conn?.deleteOutcome) {
      console.error('[outcome.delete] No connection');
      return { success: false, error: 'No connection' };
    }
    return conn.deleteOutcome(outcomeId);
  },

  isInUse(outcomeId: string): boolean {
    const conn = connectionPool.getActiveOps();
    return conn?.isOutcomeInUse?.(outcomeId) ?? false;
  },
};
