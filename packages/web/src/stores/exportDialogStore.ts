/**
 * exportDialogStore - which project the export dialog is open for, and the
 * studies it was opened from (a row menu pre-scopes to one study).
 */

import { create } from 'zustand';

interface ExportDialogState {
  isOpen: boolean;
  projectId: string | null;
  /** null means the dialog starts with every eligible study selected. */
  studyIds: string[] | null;
  open: (projectId: string, studyIds?: string[]) => void;
  close: () => void;
}

export const useExportDialogStore = create<ExportDialogState>()(set => ({
  isOpen: false,
  projectId: null,
  studyIds: null,
  open: (projectId, studyIds) => set({ isOpen: true, projectId, studyIds: studyIds ?? null }),
  close: () => set({ isOpen: false }),
}));
