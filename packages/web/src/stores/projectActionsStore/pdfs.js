/**
 * PDF operations for projectActionsStore
 */

import { uploadPdf, downloadPdf, deletePdf } from '@api/pdf-api.js';
import { cachePdf, removeCachedPdf, getCachedPdf } from '@primitives/pdfCache.js';
import { bestEffort } from '@lib/errorLogger.js';
import { extractPdfDoi, extractPdfTitle } from '@/lib/pdfUtils.js';
import { fetchFromDOI } from '@/lib/referenceLookup.js';
import projectStore from '../projectStore.js';
import pdfPreviewStore from '../pdfPreviewStore.js';

/**
 * Creates PDF operations
 * @param {Function} getActiveConnection - Function to get current Y.js connection
 * @param {Function} getActiveProjectId - Function to get current project ID
 * @param {Function} getActiveOrgId - Function to get current org ID
 * @param {Function} getCurrentUserId - Function to get current user ID
 * @returns {Object} PDF operations
 */
export function createPdfActions(
  getActiveConnection,
  getActiveProjectId,
  getActiveOrgId,
  getCurrentUserId,
) {
  /**
   * Extract PDF metadata (title, DOI, and fetch DOI reference data)
   * @param {ArrayBuffer} arrayBuffer - PDF file data
   * @returns {Promise<Object>} Metadata object with title, doi, firstAuthor, publicationYear, journal
   */
  async function extractPdfMetadata(arrayBuffer) {
    const metadata = {};

    if (!arrayBuffer) return metadata;

    try {
      const [extractedTitle, extractedDoi] = await Promise.all([
        extractPdfTitle(arrayBuffer.slice(0)).catch(err => {
          console.warn('PDF title extraction failed:', err.message);
          return null;
        }),
        extractPdfDoi(arrayBuffer.slice(0)).catch(err => {
          console.warn('PDF DOI extraction failed:', err.message);
          return null;
        }),
      ]);

      if (extractedTitle) metadata.title = extractedTitle;
      if (extractedDoi) metadata.doi = extractedDoi;

      // Fetch additional metadata from DOI if available
      if (extractedDoi) {
        try {
          const refData = await fetchFromDOI(extractedDoi);
          if (refData) {
            if (refData.firstAuthor) metadata.firstAuthor = refData.firstAuthor;
            if (refData.publicationYear) metadata.publicationYear = refData.publicationYear;
            if (refData.journal) metadata.journal = refData.journal;
            // Use extracted DOI if refData doesn't have one
            if (!metadata.doi) metadata.doi = refData.doi || extractedDoi;
          }
        } catch (doiErr) {
          console.warn('Failed to fetch DOI metadata:', doiErr);
        }
      }
    } catch (extractErr) {
      console.warn('Failed to extract PDF metadata:', extractErr);
    }

    return metadata;
  }

  /**
   * View a PDF (opens in slide-in drawer panel) (uses active project)
   */
  async function view(studyId, pdf) {
    if (!pdf || !pdf.fileName) return;
    const projectId = getActiveProjectId();
    const orgId = getActiveOrgId();

    pdfPreviewStore.openPreview(projectId, studyId, pdf);

    try {
      let data = await getCachedPdf(projectId, studyId, pdf.fileName);

      if (!data) {
        data = await downloadPdf(orgId, projectId, studyId, pdf.fileName);
        await bestEffort(cachePdf(projectId, studyId, pdf.fileName, data), {
          operation: 'cachePdf (view)',
          projectId,
          studyId,
          fileName: pdf.fileName,
        });
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
    const orgId = getActiveOrgId();

    try {
      let data = await getCachedPdf(projectId, studyId, pdf.fileName);

      if (!data) {
        data = await downloadPdf(orgId, projectId, studyId, pdf.fileName);
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
    const orgId = getActiveOrgId();
    const userId = getCurrentUserId();
    const ops = getActiveConnection();

    if (!ops?.addPdfToStudy) {
      throw new Error('Not connected to project');
    }

    // Check for duplicate filename before uploading
    const study = projectStore.getStudy(projectId, studyId);
    const existingPdf = study?.pdfs?.find(pdf => pdf.fileName === file.name);
    if (existingPdf) {
      throw new Error(`File "${file.name}" already exists. Rename or remove the existing copy.`);
    }

    let uploadResult = null;

    try {
      // Auto-set as primary if first PDF
      const hasPdfs = study?.pdfs?.length > 0;
      const effectiveTag = !hasPdfs ? 'primary' : tag;

      uploadResult = await uploadPdf(orgId, projectId, studyId, file, file.name);

      let arrayBuffer = null;
      try {
        arrayBuffer = await file.arrayBuffer();
      } catch (err) {
        console.warn('Failed to convert file to ArrayBuffer:', err.message);
      }
      bestEffort(cachePdf(projectId, studyId, uploadResult.fileName, arrayBuffer), {
        operation: 'cachePdf (upload)',
        projectId,
        studyId,
        fileName: uploadResult.fileName,
      });

      // Extract PDF metadata
      const pdfMetadata = await extractPdfMetadata(arrayBuffer);

      const pdfId = ops.addPdfToStudy(
        studyId,
        {
          key: uploadResult.key,
          fileName: uploadResult.fileName,
          size: uploadResult.size,
          uploadedBy: userId,
          uploadedAt: Date.now(),
          // Pass extracted citation metadata
          title: pdfMetadata.title || null,
          firstAuthor: pdfMetadata.firstAuthor || null,
          publicationYear: pdfMetadata.publicationYear || null,
          journal: pdfMetadata.journal || null,
          doi: pdfMetadata.doi || null,
        },
        effectiveTag,
      );

      return pdfId;
    } catch (err) {
      console.error('Error uploading PDF:', err);
      if (uploadResult?.fileName) {
        bestEffort(deletePdf(orgId, projectId, studyId, uploadResult.fileName), {
          operation: 'deletePdf (upload rollback)',
          projectId,
          studyId,
          fileName: uploadResult.fileName,
        });
      }
      throw err;
    }
  }

  /**
   * Delete a PDF from a study (uses active project)
   * Ensures cleanup from R2, IndexedDB, and Y.js with proper error handling
   */
  async function deletePdfFromStudy(studyId, pdf) {
    const projectId = getActiveProjectId();
    const orgId = getActiveOrgId();
    const ops = getActiveConnection();

    if (!pdf || !pdf.fileName) return;
    if (!ops?.removePdfFromStudy) {
      throw new Error('Not connected to project');
    }

    let r2Deleted = false;

    try {
      // Step 1: Delete from R2 storage first
      try {
        await deletePdf(orgId, projectId, studyId, pdf.fileName);
        r2Deleted = true;
      } catch (r2Err) {
        console.error('Failed to delete PDF from R2:', r2Err);
        // Still attempt IndexedDB cleanup even if R2 deletion fails
      }

      // Step 2: Always attempt IndexedDB cleanup, even if previous step failed
      try {
        await removeCachedPdf(projectId, studyId, pdf.fileName);
      } catch (cacheErr) {
        console.warn('Failed to remove PDF from IndexedDB cache:', cacheErr);
        // Don't throw - cache cleanup failure shouldn't block the operation
      }

      // Step 3: Remove from Y.js only if R2 deletion succeeded
      // This prevents inconsistencies where PDF exists in R2 but not in Y.js
      if (r2Deleted) {
        try {
          ops.removePdfFromStudy(studyId, pdf.id);
        } catch (yjsErr) {
          console.error('Failed to remove PDF from Y.js:', yjsErr);
          // R2 deletion succeeded but Y.js removal failed - log warning
          // The PDF will remain in Y.js but is deleted from R2
          throw new Error('PDF deleted from R2 but failed to remove from study');
        }
      }

      // If R2 deletion failed, throw to indicate the operation didn't fully succeed
      if (!r2Deleted) {
        throw new Error('Failed to delete PDF from R2 storage');
      }
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
  async function handleGoogleDriveImport(studyId, file, tag = 'secondary') {
    const projectId = getActiveProjectId();
    const orgId = getActiveOrgId();
    const userId = getCurrentUserId();
    const ops = getActiveConnection();

    if (!studyId || !file || !ops?.addPdfToStudy) return;

    const study = projectStore.getStudy(projectId, studyId);
    const hasPdfs = study?.pdfs?.length > 0;
    const effectiveTag = !hasPdfs ? 'primary' : tag;

    try {
      // Download PDF to extract metadata and cache it
      let arrayBuffer = null;
      try {
        arrayBuffer = await downloadPdf(orgId, projectId, studyId, file.fileName);
        bestEffort(cachePdf(projectId, studyId, file.fileName, arrayBuffer), {
          operation: 'cachePdf (Google Drive import)',
          projectId,
          studyId,
          fileName: file.fileName,
        });
      } catch (downloadErr) {
        console.warn(
          'Failed to download/cache Google Drive PDF for metadata extraction:',
          downloadErr,
        );
        // Continue without metadata extraction if download fails
      }

      // Extract PDF metadata
      const pdfMetadata = await extractPdfMetadata(arrayBuffer);

      ops.addPdfToStudy(
        studyId,
        {
          key: file.key,
          fileName: file.fileName,
          size: file.size,
          uploadedBy: userId,
          uploadedAt: Date.now(),
          source: 'google-drive',
          // Pass extracted citation metadata
          title: pdfMetadata.title || null,
          firstAuthor: pdfMetadata.firstAuthor || null,
          publicationYear: pdfMetadata.publicationYear || null,
          journal: pdfMetadata.journal || null,
          doi: pdfMetadata.doi || null,
        },
        effectiveTag,
      );
    } catch (err) {
      console.error('Failed to add Google Drive PDF metadata:', err);
      bestEffort(deletePdf(orgId, projectId, studyId, file.fileName), {
        operation: 'deletePdf (Google Drive rollback)',
        projectId,
        studyId,
        fileName: file.fileName,
      });
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
