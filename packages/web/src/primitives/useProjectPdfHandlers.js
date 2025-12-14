/**
 * useProjectPdfHandlers - Extracted PDF handlers
 * Handles PDF viewing, uploading, and Google Drive integration
 */

import { uploadPdf, deletePdf, getPdfUrl } from '@api/pdf-api.js';
import { cachePdf, removeCachedPdf, getCachedPdf } from '@primitives/pdfCache.js';
import projectStore from '@/stores/projectStore.js';
import { useBetterAuth } from '@api/better-auth-store.js';

/**
 * @param {string} projectId - The project ID
 * @param {Object} projectActions - Actions from useProject hook (addPdfToStudy, removePdfFromStudy)
 */
export default function useProjectPdfHandlers(projectId, projectActions) {
  const { user } = useBetterAuth();

  // Read from store directly
  const studies = () => projectStore.getStudies(projectId);

  const { addPdfToStudy, removePdfFromStudy } = projectActions;

  const handleViewPdf = async (studyId, pdf) => {
    if (!pdf || !pdf.fileName) return;

    const cachedData = await getCachedPdf(projectId, studyId, pdf.fileName);
    if (cachedData) {
      const blob = new Blob([cachedData], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    }

    const url = getPdfUrl(projectId, studyId, pdf.fileName);
    window.open(url, '_blank');
  };

  const handleUploadPdf = async (studyId, file) => {
    try {
      const study = studies().find(s => s.id === studyId);
      if (study?.pdfs?.length > 0) {
        for (const existingPdf of study.pdfs) {
          try {
            await deletePdf(projectId, studyId, existingPdf.fileName);
            removePdfFromStudy(studyId, existingPdf.fileName);
            removeCachedPdf(projectId, studyId, existingPdf.fileName).catch(err =>
              console.warn('Failed to remove PDF from cache:', err),
            );
          } catch (deleteErr) {
            console.warn('Failed to delete old PDF:', deleteErr);
          }
        }
      }

      const result = await uploadPdf(projectId, studyId, file, file.name);

      const arrayBuffer = await file.arrayBuffer();
      cachePdf(projectId, studyId, result.fileName, arrayBuffer).catch(err =>
        console.warn('Failed to cache PDF:', err),
      );

      addPdfToStudy(studyId, {
        key: result.key,
        fileName: result.fileName,
        size: result.size,
        uploadedBy: user()?.id,
        uploadedAt: Date.now(),
      });
    } catch (err) {
      console.error('Error uploading PDF:', err);
      throw err;
    }
  };

  const handleGoogleDriveImportSuccess = (studyId, file) => {
    if (!studyId || !file) return;

    addPdfToStudy(studyId, {
      key: file.key,
      fileName: file.fileName,
      size: file.size,
      uploadedBy: user()?.id,
      uploadedAt: Date.now(),
      source: 'google-drive',
    });
  };

  return {
    handleViewPdf,
    handleUploadPdf,
    handleGoogleDriveImportSuccess,
  };
}
