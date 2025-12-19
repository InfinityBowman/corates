/**
 * PDF operations for projectActionsStore
 */

import { uploadPdf, downloadPdf, deletePdf } from '@api/pdf-api.js';
import { cachePdf, removeCachedPdf, getCachedPdf } from '@primitives/pdfCache.js';
import projectStore from '../projectStore.js';
import pdfPreviewStore from '../pdfPreviewStore.js';

/**
 * Creates PDF operations
 * @param {Function} getActiveConnection - Function to get current Y.js connection
 * @param {Function} getActiveProjectId - Function to get current project ID
 * @param {Function} getCurrentUserId - Function to get current user ID
 * @returns {Object} PDF operations
 */
export function createPdfActions(getActiveConnection, getActiveProjectId, getCurrentUserId) {
  /**
   * View a PDF (opens in slide-in drawer panel) (uses active project)
   */
  async function view(studyId, pdf) {
    if (!pdf || !pdf.fileName) return;
    const projectId = getActiveProjectId();

    pdfPreviewStore.openPreview(projectId, studyId, pdf);

    try {
      let data = await getCachedPdf(projectId, studyId, pdf.fileName);

      if (!data) {
        data = await downloadPdf(projectId, studyId, pdf.fileName);
        await cachePdf(projectId, studyId, pdf.fileName, data).catch(console.warn);
      }

      pdfPreviewStore.setData(data);
    } catch (err) {
      console.error('Error loading PDF:', err);
      pdfPreviewStore.setError(err.message || 'Failed to load PDF');
    }
  }

  /**
   * Download a PDF file to user's device (uses active project)
   */
  async function download(studyId, pdf) {
    if (!pdf || !pdf.fileName) return;
    const projectId = getActiveProjectId();

    try {
      let data = await getCachedPdf(projectId, studyId, pdf.fileName);

      if (!data) {
        data = await downloadPdf(projectId, studyId, pdf.fileName);
      }

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
  }

  /**
   * Upload a new PDF to a study (uses active project and current user)
   * @param {string} studyId - Study ID
   * @param {File} file - PDF file to upload
   * @param {string} [tag='secondary'] - PDF tag
   * @returns {Promise<string>} The new PDF ID
   */
  async function upload(studyId, file, tag = 'secondary') {
    const projectId = getActiveProjectId();
    const userId = getCurrentUserId();
    const ops = getActiveConnection();

    if (!ops?.addPdfToStudy) {
      throw new Error('Not connected to project');
    }

    // Check for duplicate filename before uploading
    const study = projectStore.getStudy(projectId, studyId);
    const existingPdf = study?.pdfs?.find(pdf => pdf.fileName === file.name);
    if (existingPdf) {
      throw new Error(
          `File "${file.name}" already exists. Rename or remove the existing copy.`,
        
      );
    }

    let uploadResult = null;

    try {
      // Auto-set as primary if first PDF
      const hasPdfs = study?.pdfs?.length > 0;
      const effectiveTag = !hasPdfs ? 'primary' : tag;

      uploadResult = await uploadPdf(projectId, studyId, file, file.name);

      let arrayBuffer = null;
      try {
        arrayBuffer = await file.arrayBuffer();
      } catch {
        // Ignore cache if arrayBuffer conversion fails
      }
      cachePdf(projectId, studyId, uploadResult.fileName, arrayBuffer).catch(err =>
        console.warn('Failed to cache PDF:', err),
      );

      const pdfId = ops.addPdfToStudy(
        studyId,
        {
          key: uploadResult.key,
          fileName: uploadResult.fileName,
          size: uploadResult.size,
          uploadedBy: userId,
          uploadedAt: Date.now(),
        },
        effectiveTag,
      );

      return pdfId;
    } catch (err) {
      console.error('Error uploading PDF:', err);
      if (uploadResult?.fileName) {
        deletePdf(projectId, studyId, uploadResult.fileName).catch(cleanupErr =>
          console.warn('Failed to clean up orphaned PDF:', cleanupErr),
        );
      }
      throw err;
    }
  }

  /**
   * Delete a PDF from a study (uses active project)
   */
  async function deletePdfFromStudy(studyId, pdf) {
    const projectId = getActiveProjectId();
    const ops = getActiveConnection();

    if (!pdf || !pdf.fileName) return;
    if (!ops?.removePdfFromStudy) {
      throw new Error('Not connected to project');
    }

    try {
      await deletePdf(projectId, studyId, pdf.fileName);
      ops.removePdfFromStudy(studyId, pdf.id);
      removeCachedPdf(projectId, studyId, pdf.fileName).catch(err =>
        console.warn('Failed to remove PDF from cache:', err),
      );
    } catch (err) {
      console.error('Error deleting PDF:', err);
      throw err;
    }
  }

  /**
   * Change a PDF's tag (uses active project)
   */
  function updateTag(studyId, pdfId, newTag) {
    const ops = getActiveConnection();
    if (!ops?.updatePdfTag) return;
    ops.updatePdfTag(studyId, pdfId, newTag);
  }

  /**
   * Update PDF citation metadata (uses active project)
   */
  function updateMetadata(studyId, pdfId, metadata) {
    const ops = getActiveConnection();
    if (!ops?.updatePdfMetadata) return;
    ops.updatePdfMetadata(studyId, pdfId, metadata);
  }

  /**
   * Handle Google Drive import success (uses active project and current user)
   * @param {string} studyId - Study ID
   * @param {Object} file - Imported file metadata
   * @param {string} [tag='secondary'] - PDF tag
   */
  function handleGoogleDriveImport(studyId, file, tag = 'secondary') {
    const projectId = getActiveProjectId();
    const userId = getCurrentUserId();
    const ops = getActiveConnection();

    if (!studyId || !file || !ops?.addPdfToStudy) return;

    const study = projectStore.getStudy(projectId, studyId);
    const hasPdfs = study?.pdfs?.length > 0;
    const effectiveTag = !hasPdfs ? 'primary' : tag;

    try {
      ops.addPdfToStudy(
        studyId,
        {
          key: file.key,
          fileName: file.fileName,
          size: file.size,
          uploadedBy: userId,
          uploadedAt: Date.now(),
          source: 'google-drive',
        },
        effectiveTag,
      );
    } catch (err) {
      console.error('Failed to add Google Drive PDF metadata:', err);
      deletePdf(projectId, studyId, file.fileName).catch(console.warn);
      throw err;
    }
  }

  /**
   * Add PDF to study (low-level Y.js access)
   */
  function addToStudy(studyId, pdfMeta, tag) {
    const ops = getActiveConnection();
    return ops?.addPdfToStudy?.(studyId, pdfMeta, tag);
  }

  return {
    view,
    download,
    upload,
    delete: deletePdfFromStudy,
    updateTag,
    updateMetadata,
    handleGoogleDriveImport,
    addToStudy,
  };
}
