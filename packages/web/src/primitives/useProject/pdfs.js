/**
 * PDF operations for useProject
 *
 * PDF Tags:
 * - 'primary': The main publication/article (only one per study)
 * - 'protocol': Study protocol document (only one per study)
 * - 'secondary': Additional supplementary PDFs (default)
 */

import * as Y from 'yjs';
import { nanoid } from 'nanoid';

/**
 * Creates PDF operations
 * @param {string} projectId - The project ID
 * @param {Function} getYDoc - Function that returns the Y.Doc
 * @param {Function} isSynced - Function that returns sync status
 * @returns {Object} PDF operations
 */
export function createPdfOperations(projectId, getYDoc, isSynced) {
  /**
   * Get the pdfs Y.Map for a study, creating it if needed
   * @private
   */
  function getPdfsMap(studyId, create = false) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return null;

    let pdfsMap = studyYMap.get('pdfs');
    if (!pdfsMap && create) {
      pdfsMap = new Y.Map();
      studyYMap.set('pdfs', pdfsMap);
    }
    return pdfsMap;
  }

  /**
   * Clear a specific tag from all PDFs in a study (used to ensure only one primary/protocol)
   * @private
   */
  function clearTag(studyId, tag) {
    const pdfsMap = getPdfsMap(studyId);
    if (!pdfsMap) return;

    for (const [_pdfId, pdfYMap] of pdfsMap.entries()) {
      if (pdfYMap.get('tag') === tag) {
        pdfYMap.set('tag', 'secondary');
      }
    }
  }

  /**
   * Add PDF metadata to a study (called after successful upload to R2)
   * @param {string} studyId - The study ID
   * @param {Object} pdfInfo - PDF metadata { key, fileName, size, uploadedBy, uploadedAt, title?, firstAuthor?, publicationYear?, journal?, doi? }
   * @param {string} [tag='secondary'] - PDF tag: 'primary' | 'protocol' | 'secondary'
   * @returns {string} The generated PDF ID
   * @throws {Error} If YDoc is not ready or study doesn't exist
   */
  function addPdfToStudy(studyId, pdfInfo, tag = 'secondary') {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) {
      throw new Error('YDoc not ready');
    }

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) {
      throw new Error('Study not found');
    }

    const pdfsMap = getPdfsMap(studyId, true);

    // If setting as primary or protocol, clear existing tag first
    if (tag === 'primary' || tag === 'protocol') {
      clearTag(studyId, tag);
    }

    const pdfId = nanoid();
    console.log('pdfId', pdfId);
    const pdfYMap = new Y.Map();
    pdfYMap.set('id', pdfId);
    pdfYMap.set('key', pdfInfo.key);
    pdfYMap.set('fileName', pdfInfo.fileName);
    pdfYMap.set('size', pdfInfo.size);
    pdfYMap.set('uploadedBy', pdfInfo.uploadedBy);
    pdfYMap.set('uploadedAt', pdfInfo.uploadedAt || Date.now());
    pdfYMap.set('tag', tag);

    // Citation metadata (optional, can be added later via updatePdfMetadata)
    if (pdfInfo.title) pdfYMap.set('title', pdfInfo.title);
    if (pdfInfo.firstAuthor) pdfYMap.set('firstAuthor', pdfInfo.firstAuthor);
    if (pdfInfo.publicationYear) pdfYMap.set('publicationYear', pdfInfo.publicationYear);
    if (pdfInfo.journal) pdfYMap.set('journal', pdfInfo.journal);
    if (pdfInfo.doi) pdfYMap.set('doi', pdfInfo.doi);

    pdfsMap.set(pdfId, pdfYMap);

    studyYMap.set('updatedAt', Date.now());
    return pdfId;
  }

  /**
   * Remove PDF metadata from a study by PDF ID
   * @param {string} studyId - The study ID
   * @param {string} pdfId - The PDF ID
   */
  function removePdfFromStudy(studyId, pdfId) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    const pdfsMap = studyYMap.get('pdfs');
    if (pdfsMap) {
      pdfsMap.delete(pdfId);
    }

    studyYMap.set('updatedAt', Date.now());
  }

  /**
   * Remove PDF metadata from a study by file name (for backward compatibility)
   * @param {string} studyId - The study ID
   * @param {string} fileName - The PDF file name
   */
  function removePdfByFileName(studyId, fileName) {
    const pdfsMap = getPdfsMap(studyId);
    if (!pdfsMap) return;

    for (const [pdfId, pdfYMap] of pdfsMap.entries()) {
      if (pdfYMap.get('fileName') === fileName) {
        removePdfFromStudy(studyId, pdfId);
        return;
      }
    }
  }

  /**
   * Update PDF tag
   * @param {string} studyId - The study ID
   * @param {string} pdfId - The PDF ID
   * @param {string} tag - New tag: 'primary' | 'protocol' | 'secondary'
   */
  function updatePdfTag(studyId, pdfId, tag) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return;

    const pdfsMap = getPdfsMap(studyId);
    if (!pdfsMap) return;

    const pdfYMap = pdfsMap.get(pdfId);
    if (!pdfYMap) return;

    // If setting as primary or protocol, clear existing tag first
    if (tag === 'primary' || tag === 'protocol') {
      clearTag(studyId, tag);
    }

    pdfYMap.set('tag', tag);

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (studyYMap) {
      studyYMap.set('updatedAt', Date.now());
    }
  }

  /**
   * Update PDF citation metadata
   * @param {string} studyId - The study ID
   * @param {string} pdfId - The PDF ID
   * @param {Object} metadata - Citation metadata { title?, firstAuthor?, publicationYear?, journal?, doi? }
   */
  function updatePdfMetadata(studyId, pdfId, metadata) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return;

    const pdfsMap = getPdfsMap(studyId);
    if (!pdfsMap) return;

    const pdfYMap = pdfsMap.get(pdfId);
    if (!pdfYMap) return;

    // Update each metadata field
    const fields = ['title', 'firstAuthor', 'publicationYear', 'journal', 'doi'];
    for (const field of fields) {
      if (field in metadata) {
        if (metadata[field] !== undefined && metadata[field] !== null && metadata[field] !== '') {
          pdfYMap.set(field, metadata[field]);
        } else {
          pdfYMap.delete(field);
        }
      }
    }

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (studyYMap) {
      studyYMap.set('updatedAt', Date.now());
    }
  }

  /**
   * Set a PDF as primary (convenience method)
   * @param {string} studyId - The study ID
   * @param {string} pdfId - The PDF ID
   */
  function setPdfAsPrimary(studyId, pdfId) {
    updatePdfTag(studyId, pdfId, 'primary');
  }

  /**
   * Set a PDF as protocol (convenience method)
   * @param {string} studyId - The study ID
   * @param {string} pdfId - The PDF ID
   */
  function setPdfAsProtocol(studyId, pdfId) {
    updatePdfTag(studyId, pdfId, 'protocol');
  }

  return {
    addPdfToStudy,
    removePdfFromStudy,
    removePdfByFileName,
    updatePdfTag,
    updatePdfMetadata,
    setPdfAsPrimary,
    setPdfAsProtocol,
  };
}
