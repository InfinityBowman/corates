/**
 * Typed project actions singleton.
 * Components use `project.study.create(...)` for write operations.
 */

import { showToast } from '@/components/ui/toast';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { connectionPool } from './ConnectionPool';
import { studyActions } from './actions/studies';
import { pdfActions } from './actions/pdfs';
import { projectActions } from './actions/project';
import { memberActions } from './actions/members';
import type { ReconciliationProgressData } from '@/primitives/useProject/reconciliation.js';

export const project = {
  study: studyActions,
  pdf: pdfActions,
  project: projectActions,
  member: memberActions,

  checklist: {
    create(studyId: string, type: string, assigneeId: string | null, outcomeId?: string): boolean {
      const ops = connectionPool.getActiveOps();
      if (!ops) throw new Error('No active project connection');
      try {
        const checklistId = ops.checklist.createChecklist(
          studyId,
          type,
          assigneeId,
          outcomeId ?? null,
        );
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
      if (!ops) throw new Error('No active project connection');
      try {
        ops.checklist.updateChecklist(studyId, checklistId, updates);
      } catch (err) {
        console.error('Error updating checklist:', err);
        showToast.error('Update Failed', 'Failed to update checklist');
      }
    },

    delete(studyId: string, checklistId: string): void {
      const ops = connectionPool.getActiveOps();
      if (!ops) throw new Error('No active project connection');
      try {
        ops.checklist.deleteChecklist(studyId, checklistId);
      } catch (err) {
        console.error('Error deleting checklist:', err);
        showToast.error('Delete Failed', 'Failed to delete checklist');
      }
    },

    getAnswersMap(studyId: string, checklistId: string): unknown {
      const ops = connectionPool.getActiveOps();
      if (!ops) throw new Error('No active project connection');
      return ops.checklist.getChecklistAnswersMap(studyId, checklistId);
    },

    getData(studyId: string, checklistId: string): Record<string, unknown> | null {
      const ops = connectionPool.getActiveOps();
      if (!ops) throw new Error('No active project connection');
      return ops.checklist.getChecklistData(studyId, checklistId) ?? null;
    },

    updateAnswer(
      studyId: string,
      checklistId: string,
      questionId: string,
      answer: unknown,
      note?: string,
    ): void {
      const ops = connectionPool.getActiveOps();
      if (!ops) throw new Error('No active project connection');
      const data: Record<string, unknown> = { answer };
      if (note !== undefined) data.note = note;
      ops.checklist.updateChecklistAnswer(studyId, checklistId, questionId, data);
    },

    getQuestionNote(studyId: string, checklistId: string, questionId: string): unknown {
      const ops = connectionPool.getActiveOps();
      if (!ops) throw new Error('No active project connection');
      return ops.checklist.getQuestionNote(studyId, checklistId, questionId);
    },
  },

  outcome: {
    create(name: string): string | null {
      const conn = connectionPool.getActiveOps();
      if (!conn) throw new Error('No active project connection');
      const user = selectUser(useAuthStore.getState());
      if (!user?.id) {
        console.error('[outcome.create] No user logged in');
        return null;
      }
      return conn.outcome.createOutcome(name, user.id);
    },

    update(outcomeId: string, name: string): boolean {
      const conn = connectionPool.getActiveOps();
      if (!conn) throw new Error('No active project connection');
      return conn.outcome.updateOutcome(outcomeId, name);
    },

    delete(outcomeId: string): { success: boolean; error?: string } {
      const conn = connectionPool.getActiveOps();
      if (!conn) throw new Error('No active project connection');
      return conn.outcome.deleteOutcome(outcomeId);
    },

    isInUse(outcomeId: string): boolean {
      const conn = connectionPool.getActiveOps();
      if (!conn) throw new Error('No active project connection');
      return conn.outcome.isOutcomeInUse(outcomeId);
    },
  },

  reconciliation: {
    saveProgress(
      studyId: string,
      outcomeId: string | null,
      type: string,
      data: ReconciliationProgressData,
    ) {
      const ops = connectionPool.getActiveOps();
      if (!ops) throw new Error('No active project connection');
      return ops.reconciliation.saveReconciliationProgress(studyId, outcomeId, type, data);
    },

    getProgress(studyId: string, outcomeId: string | null, type: string) {
      const ops = connectionPool.getActiveOps();
      if (!ops) throw new Error('No active project connection');
      return ops.reconciliation.getReconciliationProgress(studyId, outcomeId, type);
    },

    applyToChecklists(
      studyId: string,
      checklist1Id: string,
      checklist2Id: string,
      data: Record<string, unknown>,
    ) {
      const ops = connectionPool.getActiveOps();
      if (!ops) throw new Error('No active project connection');
      return (ops.reconciliation as any).applyReconciliationToChecklists(
        studyId,
        checklist1Id,
        checklist2Id,
        data,
      );
    },
  },

  getActiveProjectId: () => connectionPool.getActiveProjectId(),
  getActiveOrgId: () => connectionPool.getActiveOrgId(),
};
