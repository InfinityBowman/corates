/**
 * Typed project actions singleton.
 * Replaces the untyped `projectActionsStore as any` pattern.
 *
 * Components use `project.study.create(...)` instead of
 * `(projectActionsStore as any).study.create(...)`.
 *
 * Internal lifecycle methods (_setConnection, _setActiveProject, etc.)
 * are NOT exported here -- they're used only by ProjectGate and useProject.
 */

import _store from '@/stores/projectActionsStore/index.js';

// The store is plain JS with no type exports. Cast once here so consumers
// don't need to. Full TypeScript interfaces for each action module can be
// added incrementally as the JS modules are converted to TS.
const store = _store as any;

export const project = {
  study: store.study as {
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

  checklist: store.checklist as {
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
  },

  pdf: store.pdf as {
    view: (studyId: string, pdf: Record<string, unknown>) => void;
    download: (studyId: string, pdf: Record<string, unknown>) => void;
    upload: (studyId: string, file: File, tag?: string) => Promise<string>;
    delete: (studyId: string, pdf: Record<string, unknown>) => Promise<void>;
    updateTag: (studyId: string, pdfId: string, newTag: string) => void;
    updateMetadata: (studyId: string, pdfId: string, metadata: Record<string, unknown>) => void;
    handleGoogleDriveImport: (studyId: string, file: unknown, tag?: string) => Promise<void>;
    addToStudy: (studyId: string, pdfMeta: Record<string, unknown>, tag?: string) => void;
  },

  project: store.project as {
    rename: (newName: string) => Promise<void>;
    updateDescription: (newDescription: string) => Promise<void>;
    delete: () => Promise<void>;
    deleteById: (targetProjectId: string, targetOrgId?: string) => Promise<void>;
  },

  member: store.member as {
    remove: (memberId: string) => Promise<{ isSelf: boolean }>;
  },

  reconciliation: store.reconciliation as {
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

  outcome: store.outcome as {
    create: (name: string) => string | null;
    update: (outcomeId: string, name: string) => boolean;
    delete: (outcomeId: string) => { success: boolean; error?: string };
    isInUse: (outcomeId: string) => boolean;
  },

  /** Get active project ID or null */
  getActiveProjectId: store.getActiveProjectId as () => string | null,
  /** Get active org ID or null */
  getActiveOrgId: store.getActiveOrgId as () => string | null,
};
