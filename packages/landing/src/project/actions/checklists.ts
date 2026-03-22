/**
 * Checklist actions -- create, update, delete, get data
 */

import { showToast } from '@/components/ui/toast';
import { connectionPool } from '../ConnectionPool';

export const checklistActions = {
  create(studyId: string, type: string, assigneeId: string | null, outcomeId?: string): boolean {
    const ops = connectionPool.getActiveOps();
    if (!ops?.createChecklist) {
      showToast.error('Addition Failed', 'Not connected to project');
      return false;
    }
    try {
      const checklistId = ops.createChecklist(studyId, type, assigneeId, outcomeId ?? null);
      if (!checklistId) {
        const requiresOutcome = type === 'ROB2' || type === 'ROBINS_I';
        if (requiresOutcome && !outcomeId) {
          showToast.error('Addition Failed', `${type} requires an outcome to be selected`);
        } else if (requiresOutcome) {
          showToast.error(
            'Addition Failed',
            'You already have a checklist for this outcome. Select a different outcome.',
          );
        } else {
          showToast.error('Addition Failed', 'Failed to add checklist');
        }
        return false;
      }
      return true;
    } catch (err) {
      console.error('Error adding checklist:', err);
      showToast.error('Addition Failed', 'Failed to add checklist');
      return false;
    }
  },

  update(studyId: string, checklistId: string, updates: Record<string, unknown>): void {
    const ops = connectionPool.getActiveOps();
    if (!ops?.updateChecklist) {
      showToast.error('Update Failed', 'Not connected to project');
      return;
    }
    try {
      ops.updateChecklist(studyId, checklistId, updates);
    } catch (err) {
      console.error('Error updating checklist:', err);
      showToast.error('Update Failed', 'Failed to update checklist');
    }
  },

  delete(studyId: string, checklistId: string): void {
    const ops = connectionPool.getActiveOps();
    if (!ops?.deleteChecklist) {
      showToast.error('Delete Failed', 'Not connected to project');
      return;
    }
    try {
      ops.deleteChecklist(studyId, checklistId);
    } catch (err) {
      console.error('Error deleting checklist:', err);
      showToast.error('Delete Failed', 'Failed to delete checklist');
    }
  },

  getAnswersMap(studyId: string, checklistId: string): unknown {
    return connectionPool.getActiveOps()?.getChecklistAnswersMap?.(studyId, checklistId);
  },

  getData(studyId: string, checklistId: string): Record<string, unknown> | null {
    try {
      return connectionPool.getActiveOps()?.getChecklistData?.(studyId, checklistId) ?? null;
    } catch (err) {
      if ((err as Error).message?.includes('No active project')) return null;
      throw err;
    }
  },

  updateAnswer(studyId: string, checklistId: string, questionId: string, answer: unknown, note?: string): void {
    connectionPool.getActiveOps()?.updateChecklistAnswer?.(studyId, checklistId, questionId, answer, note);
  },

  getQuestionNote(studyId: string, checklistId: string, questionId: string): unknown {
    return connectionPool.getActiveOps()?.getQuestionNote?.(studyId, checklistId, questionId);
  },
};
