/**
 * useProjectPdfHandlers - Extracted PDF handlers for ProjectView
 * Handles PDF viewing, uploading, and Google Drive integration
 */

import { uploadPdf, deletePdf, getPdfUrl } from '@api/pdf-api.js';
import { cachePdf, removeCachedPdf, getCachedPdf } from '@primitives/pdfCache.js';

/**
 * @param {Object} options
 * @param {string} options.projectId - The project ID
 * @param {Function} options.user - Signal getter for current user
 * @param {Function} options.studies - Signal getter for studies array
 * @param {Object} options.projectActions - Actions from useProject hook
 * @param {Function} options.setShowGoogleDriveModal - Signal setter
 * @param {Function} options.setGoogleDriveTargetStudyId - Signal setter
 * @param {Function} options.googleDriveTargetStudyId - Signal getter
 */
export default function useProjectPdfHandlers(options) {
  const {
    projectId,
    user,
    studies,
    projectActions,
    setShowGoogleDriveModal,
    setGoogleDriveTargetStudyId,
    googleDriveTargetStudyId,
  } = options;

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

  const handleOpenGoogleDrive = studyId => {
    setGoogleDriveTargetStudyId(studyId);
    setShowGoogleDriveModal(true);
  };

  const handleGoogleDriveImportSuccess = file => {
    const studyId = googleDriveTargetStudyId();
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
    handleOpenGoogleDrive,
    handleGoogleDriveImportSuccess,
  };
}
