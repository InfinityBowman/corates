/**
 * Reconciliation actions -- save/load reconciliation progress
 */

import { connectionPool } from '../ConnectionPool';
import type { ReconciliationProgressData } from '@/primitives/useProject/reconciliation.js';

export const reconciliationActions = {
  saveProgress(studyId: string, outcomeId: string | null, type: string, data: ReconciliationProgressData) {
    const ops = connectionPool.getActiveOps();
    if (!ops) throw new Error('No active project connection');
    return ops.reconciliation.saveReconciliationProgress(studyId, outcomeId, type, data);
  },

  getProgress(studyId: string, outcomeId: string | null, type: string) {
    const ops = connectionPool.getActiveOps();
    if (!ops) throw new Error('No active project connection');
    return ops.reconciliation.getReconciliationProgress(studyId, outcomeId, type);
  },

  applyToChecklists(studyId: string, checklist1Id: string, checklist2Id: string, data: Record<string, unknown>) {
    const ops = connectionPool.getActiveOps();
    if (!ops) throw new Error('No active project connection');
    return (ops.reconciliation as any).applyReconciliationToChecklists(studyId, checklist1Id, checklist2Id, data);
  },
};
