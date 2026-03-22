/**
 * Reconciliation actions -- save/load reconciliation progress
 */

import { connectionPool } from '../ConnectionPool';

export const reconciliationActions = {
  saveProgress(studyId: string, checklist1Id: string, checklist2Id: string, data: Record<string, unknown>) {
    const ops = connectionPool.getActiveOps();
    if (!ops) throw new Error('No active project connection');
    return ops.saveReconciliationProgress(studyId, checklist1Id, checklist2Id, data);
  },

  getProgress(studyId: string, checklist1Id: string, checklist2Id: string) {
    const ops = connectionPool.getActiveOps();
    if (!ops) throw new Error('No active project connection');
    return ops.getReconciliationProgress(studyId, checklist1Id, checklist2Id);
  },

  applyToChecklists(studyId: string, checklist1Id: string, checklist2Id: string, data: Record<string, unknown>) {
    const ops = connectionPool.getActiveOps();
    if (!ops) throw new Error('No active project connection');
    return ops.applyReconciliationToChecklists(studyId, checklist1Id, checklist2Id, data);
  },
};
