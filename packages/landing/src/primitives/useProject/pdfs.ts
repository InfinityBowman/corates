/**
 * PDF operations for useProject
 *
 * PDF Tags:
 * - 'primary': The main publication/article (only one per study)
 * - 'protocol': Study protocol document (only one per study)
 * - 'secondary': Additional supplementary PDFs (default)
 */

import * as Y from 'yjs';

export type PdfTag = 'primary' | 'protocol' | 'secondary';

export interface PdfInfo {
  key: string;
  fileName: string;
  size: number;
  uploadedBy: string;
  uploadedAt?: number;
  title?: string;
  firstAuthor?: string;
  publicationYear?: string;
  journal?: string;
  doi?: string;
}

export interface PdfCitationMetadata {
  title?: string;
  firstAuthor?: string;
  publicationYear?: string;
  journal?: string;
  doi?: string;
}

export interface PdfOperations {
  addPdfToStudy: (studyId: string, pdfInfo: PdfInfo, tag?: PdfTag) => string | null;
  removePdfFromStudy: (studyId: string, pdfId: string) => void;
  removePdfByFileName: (studyId: string, fileName: string) => void;
  updatePdfTag: (studyId: string, pdfId: string, tag: PdfTag) => void;
  updatePdfMetadata: (studyId: string, pdfId: string, metadata: PdfCitationMetadata) => void;
  setPdfAsPrimary: (studyId: string, pdfId: string) => void;
  setPdfAsProtocol: (studyId: string, pdfId: string) => void;
}

/**
 * Creates PDF operations
 */
export function createPdfOperations(
  _projectId: string,
  getYDoc: () => Y.Doc | null,
  _isSynced: () => boolean,
): PdfOperations {
  /**
   * Get the pdfs Y.Map for a study, creating it if needed
   */
  function getPdfsMap(studyId: string, create: boolean = false): Y.Map<unknown> | null {
    const ydoc = getYDoc();
    if (!ydoc) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
    if (!studyYMap) return null;

    let pdfsMap = studyYMap.get('pdfs') as Y.Map<unknown> | undefined;
    if (!pdfsMap && create) {
      pdfsMap = new Y.Map();
      studyYMap.set('pdfs', pdfsMap);
    }
    return pdfsMap ?? null;
  }

  /**
   * Clear a specific tag from all PDFs in a study (used to ensure only one primary/protocol)
   */
  function clearTag(studyId: string, tag: PdfTag): void {
    const pdfsMap = getPdfsMap(studyId);
    if (!pdfsMap) return;

    for (const [_pdfId, pdfYMap] of pdfsMap.entries()) {
      if ((pdfYMap as Y.Map<unknown>).get('tag') === tag) {
        (pdfYMap as Y.Map<unknown>).set('tag', 'secondary');
      }
    }
  }

  function addPdfToStudy(
    studyId: string,
    pdfInfo: PdfInfo,
    tag: PdfTag = 'secondary',
  ): string | null {
    const ydoc = getYDoc();
    if (!ydoc) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
    if (!studyYMap) return null;

    const pdfsMap = getPdfsMap(studyId, true)!;

    // If setting as primary or protocol, clear existing tag first
    if (tag === 'primary' || tag === 'protocol') {
      clearTag(studyId, tag);
    }

    const pdfId = crypto.randomUUID();
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

  function removePdfFromStudy(studyId: string, pdfId: string): void {
    const ydoc = getYDoc();
    if (!ydoc) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
    if (!studyYMap) return;

    const pdfsMap = studyYMap.get('pdfs') as Y.Map<unknown> | undefined;
    if (pdfsMap) {
      pdfsMap.delete(pdfId);
    }

    studyYMap.set('updatedAt', Date.now());
  }

  function removePdfByFileName(studyId: string, fileName: string): void {
    const pdfsMap = getPdfsMap(studyId);
    if (!pdfsMap) return;

    for (const [pdfId, pdfYMap] of pdfsMap.entries()) {
      if ((pdfYMap as Y.Map<unknown>).get('fileName') === fileName) {
        removePdfFromStudy(studyId, pdfId);
        return;
      }
    }
  }

  function updatePdfTag(studyId: string, pdfId: string, tag: PdfTag): void {
    const ydoc = getYDoc();
    if (!ydoc) return;

    const pdfsMap = getPdfsMap(studyId);
    if (!pdfsMap) return;

    const pdfYMap = pdfsMap.get(pdfId) as Y.Map<unknown> | undefined;
    if (!pdfYMap) return;

    // If setting as primary or protocol, clear existing tag first
    if (tag === 'primary' || tag === 'protocol') {
      clearTag(studyId, tag);
    }

    pdfYMap.set('tag', tag);

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
    if (studyYMap) {
      studyYMap.set('updatedAt', Date.now());
    }
  }

  function updatePdfMetadata(
    studyId: string,
    pdfId: string,
    metadata: PdfCitationMetadata,
  ): void {
    const ydoc = getYDoc();
    if (!ydoc) return;

    const pdfsMap = getPdfsMap(studyId);
    if (!pdfsMap) return;

    const pdfYMap = pdfsMap.get(pdfId) as Y.Map<unknown> | undefined;
    if (!pdfYMap) return;

    // Update each metadata field
    const fields: (keyof PdfCitationMetadata)[] = [
      'title',
      'firstAuthor',
      'publicationYear',
      'journal',
      'doi',
    ];
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
    const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
    if (studyYMap) {
      studyYMap.set('updatedAt', Date.now());
    }
  }

  function setPdfAsPrimary(studyId: string, pdfId: string): void {
    updatePdfTag(studyId, pdfId, 'primary');
  }

  function setPdfAsProtocol(studyId: string, pdfId: string): void {
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
