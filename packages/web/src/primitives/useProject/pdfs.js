/**
 * PDF operations for useProject
 */

import * as Y from 'yjs';

/**
 * Creates PDF operations
 * @param {string} projectId - The project ID
 * @param {Function} getYDoc - Function that returns the Y.Doc
 * @param {Function} isSynced - Function that returns sync status
 * @returns {Object} PDF operations
 */
export function createPdfOperations(projectId, getYDoc, isSynced) {
  /**
   * Add PDF metadata to a study (called after successful upload to R2)
   * @param {string} studyId - The study ID
   * @param {Object} pdfInfo - PDF metadata { key, fileName, size, uploadedBy, uploadedAt }
   */
  function addPdfToStudy(studyId, pdfInfo) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    let pdfsMap = studyYMap.get('pdfs');
    if (!pdfsMap) {
      pdfsMap = new Y.Map();
      studyYMap.set('pdfs', pdfsMap);
    }

    const pdfYMap = new Y.Map();
    pdfYMap.set('key', pdfInfo.key);
    pdfYMap.set('fileName', pdfInfo.fileName);
    pdfYMap.set('size', pdfInfo.size);
    pdfYMap.set('uploadedBy', pdfInfo.uploadedBy);
    pdfYMap.set('uploadedAt', pdfInfo.uploadedAt || Date.now());
    pdfsMap.set(pdfInfo.fileName, pdfYMap);

    studyYMap.set('updatedAt', Date.now());
  }

  /**
   * Remove PDF metadata from a study (called after successful delete from R2)
   * @param {string} studyId - The study ID
   * @param {string} fileName - The PDF file name
   */
  function removePdfFromStudy(studyId, fileName) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    const pdfsMap = studyYMap.get('pdfs');
    if (pdfsMap) {
      pdfsMap.delete(fileName);
    }

    studyYMap.set('updatedAt', Date.now());
  }

  return {
    addPdfToStudy,
    removePdfFromStudy,
  };
}
