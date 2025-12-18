/**
 * useProjectPdfHandlers - Extracted PDF handlers
 * Handles PDF viewing, uploading, downloading, and tag management
 *
 * Supports multiple PDFs per study with tags:
 * - primary: Main publication/article (only one per study)
 * - protocol: Study protocol document (only one per study)
 * - secondary: Additional supplementary PDFs (default)
 */

import { uploadPdf, deletePdf, downloadPdf } from '@api/pdf-api.js';
import { cachePdf, removeCachedPdf, getCachedPdf } from '@primitives/pdfCache.js';
import projectStore from '@/stores/projectStore.js';
import pdfPreviewStore from '@/stores/pdfPreviewStore.js';
import { useBetterAuth } from '@api/better-auth-store.js';

/**
 * @param {string} projectId - The project ID
 * @param {Object} projectActions - Actions from useProject hook
 */
export default function useProjectPdfHandlers(projectId, projectActions) {
  const { user } = useBetterAuth();

  // Read from store directly
  const studies = () => projectStore.getStudies(projectId);

  const {
    addPdfToStudy,
    removePdfFromStudy,
    updatePdfTag,
    updatePdfMetadata,
    setPdfAsPrimary,
    setPdfAsProtocol,
  } = projectActions;

  /**
   * View a PDF (opens in slide-in drawer panel)
   */
  const handleViewPdf = async (studyId, pdf) => {
    if (!pdf || !pdf.fileName) return;

    // Open the preview panel immediately
    pdfPreviewStore.openPreview(projectId, studyId, pdf);

    try {
      // Try cache first
      let data = await getCachedPdf(projectId, studyId, pdf.fileName);

      if (!data) {
        // Fetch from server
        data = await downloadPdf(projectId, studyId, pdf.fileName);
        // Cache for future use
        await cachePdf(projectId, studyId, pdf.fileName, data).catch(console.warn);
      }

      pdfPreviewStore.setData(data);
    } catch (err) {
      console.error('Error loading PDF:', err);
      pdfPreviewStore.setError(err.message || 'Failed to load PDF');
    }
  };

  /**
   * Download a PDF file
   */
  const handleDownloadPdf = async (studyId, pdf) => {
    if (!pdf || !pdf.fileName) return;

    try {
      // Try cache first
      let data = await getCachedPdf(projectId, studyId, pdf.fileName);

      if (!data) {
        // Fetch from server
        data = await downloadPdf(projectId, studyId, pdf.fileName);
      }

      // Trigger download
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdf.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      throw err;
    }
  };

  /**
   * Upload a new PDF to a study
   * @param {string} studyId - The study ID
   * @param {File} file - The PDF file
   * @param {string} [tag='secondary'] - Tag for the PDF: 'primary' | 'protocol' | 'secondary'
   * @returns {Promise<string>} The new PDF ID
   */
  const handleUploadPdf = async (studyId, file, tag = 'secondary') => {
    let uploadResult = null;
    try {
      // Determine tag: if this is the first PDF, auto-set as primary
      const study = studies().find(s => s.id === studyId);
      const hasPdfs = study?.pdfs?.length > 0;
      const effectiveTag = !hasPdfs ? 'primary' : tag;

      uploadResult = await uploadPdf(projectId, studyId, file, file.name);

      const arrayBuffer = await file.arrayBuffer();
      cachePdf(projectId, studyId, uploadResult.fileName, arrayBuffer).catch(err =>
        console.warn('Failed to cache PDF:', err),
      );

      const pdfId = addPdfToStudy(
        studyId,
        {
          key: uploadResult.key,
          fileName: uploadResult.fileName,
          size: uploadResult.size,
          uploadedBy: user()?.id,
          uploadedAt: Date.now(),
        },
        effectiveTag,
      );

      return pdfId;
    } catch (err) {
      console.error('Error uploading PDF:', err);
      // Clean up the uploaded file if metadata save failed
      if (uploadResult?.fileName) {
        deletePdf(projectId, studyId, uploadResult.fileName).catch(cleanupErr =>
          console.warn('Failed to clean up orphaned PDF:', cleanupErr),
        );
      }
      throw err;
    }
  };

  /**
   * Delete a PDF from a study
   * @param {string} studyId - The study ID
   * @param {Object} pdf - The PDF object with id and fileName
   */
  const handleDeletePdf = async (studyId, pdf) => {
    if (!pdf || !pdf.fileName) return;

    try {
      await deletePdf(projectId, studyId, pdf.fileName);
      removePdfFromStudy(studyId, pdf.id);
      removeCachedPdf(projectId, studyId, pdf.fileName).catch(err =>
        console.warn('Failed to remove PDF from cache:', err),
      );
    } catch (err) {
      console.error('Error deleting PDF:', err);
      throw err;
    }
  };

  /**
   * Change a PDF's tag
   * @param {string} studyId - The study ID
   * @param {string} pdfId - The PDF ID
   * @param {string} newTag - New tag: 'primary' | 'protocol' | 'secondary'
   */
  const handleTagChange = (studyId, pdfId, newTag) => {
    updatePdfTag(studyId, pdfId, newTag);
  };

  /**
   * Update PDF citation metadata
   * @param {string} studyId - The study ID
   * @param {string} pdfId - The PDF ID
   * @param {Object} metadata - Citation metadata { title?, firstAuthor?, publicationYear?, journal?, doi?, abstract? }
   */
  const handleUpdatePdfMetadata = (studyId, pdfId, metadata) => {
    updatePdfMetadata(studyId, pdfId, metadata);
  };

  /**
   * Handle Google Drive import success
   */
  const handleGoogleDriveImportSuccess = (studyId, file, tag = 'secondary') => {
    if (!studyId || !file) return;

    // Determine tag: if this is the first PDF, auto-set as primary
    const study = studies().find(s => s.id === studyId);
    const hasPdfs = study?.pdfs?.length > 0;
    const effectiveTag = !hasPdfs ? 'primary' : tag;

    try {
      addPdfToStudy(
        studyId,
        {
          key: file.key,
          fileName: file.fileName,
          size: file.size,
          uploadedBy: user()?.id,
          uploadedAt: Date.now(),
          source: 'google-drive',
        },
        effectiveTag,
      );
    } catch (err) {
      console.error('Failed to add PDF metadata:', err);
      // Clean up the imported file since metadata save failed
      deletePdf(projectId, studyId, file.fileName).catch(cleanupErr =>
        console.warn('Failed to clean up orphaned PDF:', cleanupErr),
      );
      throw err;
    }
  };

  return {
    handleViewPdf,
    handleDownloadPdf,
    handleUploadPdf,
    handleDeletePdf,
    handleTagChange,
    handleUpdatePdfMetadata,
    handleGoogleDriveImportSuccess,
    // Convenience methods
    setPdfAsPrimary: (studyId, pdfId) => setPdfAsPrimary(studyId, pdfId),
    setPdfAsProtocol: (studyId, pdfId) => setPdfAsProtocol(studyId, pdfId),
  };
}
