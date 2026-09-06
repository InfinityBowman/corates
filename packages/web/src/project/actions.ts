/**
 * Typed project actions singleton.
 * Components use `project.study.create(...)` for write operations.
 *
 * Writes are fire-and-forget mutations through the engine's outbox: the
 * optimistic apply makes the row exist locally immediately, and a rejected
 * mutation rolls back and surfaces through the pool's global rejection toast.
 */

import { showToast } from '@/lib/toast';
import { clientLogger } from '@/lib/clientLogger';
import { serializeAnswerRows } from '@corates/shared/sync';
import type { ChecklistStatus } from '@corates/shared/checklists';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { connectionPool } from './ConnectionPool';
import { studyActions } from './actions/studies';
import { pdfActions } from './actions/pdfs';
import { projectActions } from './actions/project';
import { memberActions } from './actions/members';

function requireClient() {
  const client = connectionPool.getActiveClient();
  if (!client) throw new Error('No active project connection');
  return client;
}

function activeCollections() {
  const projectId = connectionPool.getActiveProjectId();
  return projectId ? connectionPool.getCollections(projectId) : null;
}

function isOutcomeInUse(outcomeId: string): boolean {
  const collections = activeCollections();
  if (!collections) throw new Error('No active project connection');
  return collections.checklists.toArray.some(checklist => checklist.outcomeId === outcomeId);
}

export const project = {
  study: studyActions,
  pdf: pdfActions,
  project: projectActions,
  member: memberActions,

  checklist: {
    create(studyId: string, type: string, assigneeId: string | null, outcomeId?: string): boolean {
      const client = requireClient();
      const requiresOutcome = type === 'ROB2' || type === 'ROBINS_I';
      if (requiresOutcome && !outcomeId) {
        showToast.error('Addition Failed', `${type} requires an outcome to be selected`);
        return false;
      }
      void client.mutate.checklist.create({
        id: crypto.randomUUID(),
        studyId,
        type: type as 'AMSTAR2' | 'ROB2' | 'ROBINS_I',
        assignedTo: assigneeId,
        outcomeId: outcomeId ?? null,
        now: Date.now(),
      });
      clientLogger.info('client.checklist.created', { type });
      return true;
    },

    changeOutcome(
      studyId: string,
      type: string,
      fromOutcomeId: string,
      toOutcomeId: string,
    ): boolean {
      const client = requireClient();
      void client.mutate.checklist.changeOutcome({
        studyId,
        type: type as 'AMSTAR2' | 'ROB2' | 'ROBINS_I',
        fromOutcomeId,
        toOutcomeId,
        now: Date.now(),
      });
      clientLogger.info('client.checklist.outcome_changed', { type });
      showToast.success('Outcome Changed', 'Checklists moved to the selected outcome.');
      return true;
    },

    sendBackToTodo(studyId: string, type: string, outcomeId: string | null): boolean {
      const client = requireClient();
      void client.mutate.checklist.sendBackToTodo({
        studyId,
        outcomeId,
        type: type as 'AMSTAR2' | 'ROB2' | 'ROBINS_I',
        now: Date.now(),
      });
      clientLogger.info('client.checklist.sent_back_to_todo', { type });
      showToast.success('Sent Back', "The appraisal is back in the reviewers' To-Do lists.");
      return true;
    },

    update(_studyId: string, checklistId: string, updates: Record<string, unknown>): void {
      const client = requireClient();
      void client.mutate.checklist.update({
        checklistId,
        updates: updates as {
          title?: string;
          assignedTo?: string | null;
          status?: ChecklistStatus;
        },
        now: Date.now(),
      });
    },

    delete(_studyId: string, checklistId: string): void {
      const client = requireClient();
      void client.mutate.checklist.delete({ checklistId, now: Date.now() });
    },

    getData(_studyId: string, checklistId: string): Record<string, unknown> | null {
      const collections = activeCollections();
      if (!collections) throw new Error('No active project connection');
      const checklist = collections.checklists.get(checklistId);
      if (!checklist) return null;
      const flat: Record<string, unknown> = {};
      for (const row of collections.answers.toArray) {
        if (row.checklistId === checklistId) flat[row.key] = row.value;
      }
      return { ...checklist, answers: serializeAnswerRows(checklist.type, flat) };
    },
  },

  outcome: {
    create(name: string): string | null {
      const client = requireClient();
      const user = selectUser(useAuthStore.getState());
      if (!user?.id) {
        console.error('[outcome.create] No user logged in');
        return null;
      }
      if (!name.trim()) return null;
      const id = crypto.randomUUID();
      void client.mutate.outcome.create({ id, name, createdBy: user.id, now: Date.now() });
      return id;
    },

    update(outcomeId: string, name: string): boolean {
      const client = requireClient();
      if (!name.trim()) return false;
      void client.mutate.outcome.update({ id: outcomeId, name });
      return true;
    },

    delete(outcomeId: string): { success: boolean; error?: string } {
      const client = requireClient();
      // Pre-checked client-side so the caller's synchronous error UX survives;
      // the server enforces the same guard authoritatively.
      if (isOutcomeInUse(outcomeId)) {
        return { success: false, error: 'Cannot delete outcome that is in use by checklists' };
      }
      void client.mutate.outcome.delete({ id: outcomeId });
      return { success: true };
    },

    isInUse(outcomeId: string): boolean {
      return isOutcomeInUse(outcomeId);
    },
  },

  getActiveProjectId: () => connectionPool.getActiveProjectId(),
  getActiveOrgId: () => connectionPool.getActiveOrgId(),
};
