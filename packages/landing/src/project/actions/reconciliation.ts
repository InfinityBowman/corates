/**
 * Reconciliation actions -- save/load reconciliation progress
 */

import { connectionPool } from '../ConnectionPool';

export const reconciliationActions = {
  saveProgress(studyId: string, checklist1Id: string, checklist2Id: string, data: Record<string, unknown>) {
    return connectionPool.getActiveOps()?.saveReconciliationProgress?.(studyId, checklist1Id, checklist2Id, data);
  },

  getProgress(studyId: string, checklist1Id: string, checklist2Id: string) {
    return connectionPool.getActiveOps()?.getReconciliationProgress?.(studyId, checklist1Id, checklist2Id);
  },

  applyToChecklists(studyId: string, checklist1Id: string, checklist2Id: string, data: Record<string, unknown>) {
    return connectionPool.getActiveOps()?.applyReconciliationToChecklists?.(studyId, checklist1Id, checklist2Id, data);
  },
};
