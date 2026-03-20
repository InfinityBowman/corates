/**
 * pdfPreviewStore - Global store for managing PDF preview drawer state
 *
 * Used by PdfPreviewPanel to show PDFs in a slide-in drawer instead of
 * opening them in a new browser tab.
 */

import { create } from 'zustand';

interface PdfInfo {
  id: string;
  fileName: string;
  tag?: string;
  [key: string]: unknown;
}

interface PdfPreviewState {
  isOpen: boolean;
  projectId: string | null;
  studyId: string | null;
  pdf: PdfInfo | null;
  pdfData: ArrayBuffer | null;
  loading: boolean;
  error: string | null;
}

/* eslint-disable no-unused-vars */
interface PdfPreviewActions {
  openPreview: (projectId: string, studyId: string, pdfInfo: PdfInfo) => void;
  closePreview: () => void;
  setData: (data: ArrayBuffer) => void;
  setError: (errorMsg: string) => void;
}
/* eslint-enable no-unused-vars */

let closeTimeoutId: ReturnType<typeof setTimeout> | null = null;

export const usePdfPreviewStore = create<PdfPreviewState & PdfPreviewActions>()(set => ({
  isOpen: false,
  projectId: null,
  studyId: null,
  pdf: null,
  pdfData: null,
  loading: false,
  error: null,

  openPreview: (projectId, studyId, pdfInfo) => {
    if (closeTimeoutId) {
      clearTimeout(closeTimeoutId);
      closeTimeoutId = null;
    }
    set({
      projectId,
      studyId,
      pdf: pdfInfo,
      pdfData: null,
      error: null,
      loading: true,
      isOpen: true,
    });
  },

  closePreview: () => {
    set({ isOpen: false });
    // Clear state after animation completes
    closeTimeoutId = setTimeout(() => {
      closeTimeoutId = null;
      set({
        projectId: null,
        studyId: null,
        pdf: null,
        pdfData: null,
        loading: false,
        error: null,
      });
    }, 300);
  },

  setData: data => set({ pdfData: data, loading: false }),

  setError: errorMsg => set({ error: errorMsg, loading: false }),
}));
