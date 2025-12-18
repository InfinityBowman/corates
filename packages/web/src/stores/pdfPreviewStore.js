/**
 * pdfPreviewStore - Global store for managing PDF preview drawer state
 *
 * Used by PdfPreviewPanel to show PDFs in a slide-in drawer instead of
 * opening them in a new browser tab.
 */

import { createSignal } from 'solid-js';

// State signals
const [isOpen, setIsOpen] = createSignal(false);
const [projectId, setProjectId] = createSignal(null);
const [studyId, setStudyId] = createSignal(null);
const [pdf, setPdf] = createSignal(null); // { id, fileName, tag, ... }
const [pdfData, setPdfData] = createSignal(null); // ArrayBuffer
const [loading, setLoading] = createSignal(false);
const [error, setError] = createSignal(null);

/**
 * Open the PDF preview drawer
 * @param {string} projId - Project ID
 * @param {string} stId - Study ID
 * @param {Object} pdfInfo - PDF object { id, fileName, tag, ... }
 */
function openPreview(projId, stId, pdfInfo) {
  setProjectId(projId);
  setStudyId(stId);
  setPdf(pdfInfo);
  setPdfData(null);
  setError(null);
  setLoading(true);
  setIsOpen(true);
}

/**
 * Close the PDF preview drawer
 */
function closePreview() {
  setIsOpen(false);
  // Clear state after animation completes
  setTimeout(() => {
    setProjectId(null);
    setStudyId(null);
    setPdf(null);
    setPdfData(null);
    setLoading(false);
    setError(null);
  }, 300);
}

/**
 * Set the PDF data after loading
 * @param {ArrayBuffer} data - PDF file data
 */
function setData(data) {
  setPdfData(data);
  setLoading(false);
}

/**
 * Set an error state
 * @param {string} errorMsg - Error message
 */
function setErrorState(errorMsg) {
  setError(errorMsg);
  setLoading(false);
}

const pdfPreviewStore = {
  // State (read-only)
  isOpen,
  projectId,
  studyId,
  pdf,
  pdfData,
  loading,
  error,

  // Actions
  openPreview,
  closePreview,
  setData,
  setError: setErrorState,
};

export default pdfPreviewStore;
