/**
 * Typed project actions singleton.
 * Components use `project.study.create(...)` for write operations.
 *
 * Action modules receive closures that resolve the active connection
 * from the ConnectionPool, replacing the old projectActionsStore pattern.
 */

import { useAuthStore, selectUser } from '@/stores/authStore';
import { connectionPool } from './ConnectionPool';
import { createStudyActions } from '@/stores/projectActionsStore/studies.js';
import { createChecklistActions } from '@/stores/projectActionsStore/checklists.js';
import { createPdfActions } from '@/stores/projectActionsStore/pdfs.js';
import { createProjectActions } from '@/stores/projectActionsStore/project.js';
import { createMemberActions } from '@/stores/projectActionsStore/members.js';
import { createReconciliationActions } from '@/stores/projectActionsStore/reconciliation.js';
import { createOutcomeActions } from '@/stores/projectActionsStore/outcomes.js';

function getActiveProjectId(): string {
  const id = connectionPool.getActiveProjectId();
  if (!id) throw new Error('No active project - are you inside a ProjectView?');
  return id;
}

function getActiveOrgId(): string {
  const id = connectionPool.getActiveOrgId();
  if (!id) throw new Error('No active org - are you inside an org-scoped route?');
  return id;
}

function getCurrentUserId(): string | null {
  const user = selectUser(useAuthStore.getState());
  return user?.id || null;
}

function getActiveConnection() {
  const projectId = getActiveProjectId();
  return connectionPool.get(projectId);
}

// Create action modules with pool-based closures
const studyActions = createStudyActions(
  getActiveConnection,
  getActiveProjectId,
  getActiveOrgId,
  getCurrentUserId,
);
const checklistActions = createChecklistActions(getActiveConnection);
const pdfActions = createPdfActions(
  getActiveConnection,
  getActiveProjectId,
  getActiveOrgId,
  getCurrentUserId,
);
const projectActions = createProjectActions(getActiveConnection, getActiveProjectId, getActiveOrgId);
const memberActions = createMemberActions(getActiveProjectId, getActiveOrgId, getCurrentUserId);
const reconciliationActions = createReconciliationActions(getActiveConnection);
const outcomeActions = createOutcomeActions(getActiveConnection);

export const project = {
  study: studyActions as {
    create: (
      name: string,
      description?: string,
      metadata?: Record<string, unknown>,
    ) => string | null;
    update: (studyId: string, updates: Record<string, unknown>) => void;
    delete: (studyId: string) => Promise<void>;
    addBatch: (
      studiesToAdd: unknown[],
    ) => Promise<{ successCount: number; manualPdfCount: number }>;
    importReferences: (references: unknown[]) => number;
  },

  checklist: checklistActions as {
    create: (
      studyId: string,
      type: string,
      assigneeId: string | null,
      outcomeId?: string,
    ) => boolean;
    update: (studyId: string, checklistId: string, updates: Record<string, unknown>) => void;
    delete: (studyId: string, checklistId: string) => void;
    getAnswersMap: (studyId: string, checklistId: string) => unknown;
    getData: (studyId: string, checklistId: string) => Record<string, unknown> | null;
    updateAnswer: (
      studyId: string,
      checklistId: string,
      questionId: string,
      answer: unknown,
      note?: string,
    ) => void;
    getQuestionNote: (studyId: string, checklistId: string, questionId: string) => unknown;
    getTextRef: (
      studyId: string,
      checklistId: string,
      params?: { sectionKey?: string; fieldKey?: string; questionKey?: string },
    ) => unknown;
    setTextValue: (
      studyId: string,
      checklistId: string,
      params: { sectionKey?: string; fieldKey?: string; questionKey?: string },
      text: string,
      maxLength?: number,
    ) => void;
  },

  pdf: pdfActions as {
    view: (studyId: string, pdf: Record<string, unknown>) => void;
    download: (studyId: string, pdf: Record<string, unknown>) => void;
    upload: (studyId: string, file: File, tag?: string) => Promise<string>;
    delete: (studyId: string, pdf: Record<string, unknown>) => Promise<void>;
    updateTag: (studyId: string, pdfId: string, newTag: string) => void;
    updateMetadata: (studyId: string, pdfId: string, metadata: Record<string, unknown>) => void;
    handleGoogleDriveImport: (studyId: string, file: unknown, tag?: string) => Promise<void>;
    addToStudy: (studyId: string, pdfMeta: Record<string, unknown>, tag?: string) => void;
  },

  project: projectActions as {
    rename: (newName: string) => Promise<void>;
    updateDescription: (newDescription: string) => Promise<void>;
    delete: () => Promise<void>;
    deleteById: (targetProjectId: string, targetOrgId?: string) => Promise<void>;
  },

  member: memberActions as {
    remove: (memberId: string) => Promise<{ isSelf: boolean }>;
  },

  reconciliation: reconciliationActions as {
    saveProgress: (
      studyId: string,
      c1Id: string,
      c2Id: string,
      data: Record<string, unknown>,
    ) => void;
    getProgress: (
      studyId: string,
      c1Id: string,
      c2Id: string,
    ) => Record<string, unknown> | undefined;
    applyToChecklists: (
      studyId: string,
      c1Id: string,
      c2Id: string,
      data: Record<string, unknown>,
    ) => void;
  },

  outcome: outcomeActions as {
    create: (name: string) => string | null;
    update: (outcomeId: string, name: string) => boolean;
    delete: (outcomeId: string) => { success: boolean; error?: string };
    isInUse: (outcomeId: string) => boolean;
  },

  getActiveProjectId: () => connectionPool.getActiveProjectId(),
  getActiveOrgId: () => connectionPool.getActiveOrgId(),
};
