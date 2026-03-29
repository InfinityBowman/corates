/**
 * PDF annotation operations for useProject
 *
 * Annotations are stored per-study, grouped by checklistId for ownership.
 * During individual review, each reviewer's annotations are tied to their checklist.
 * During reconciliation, annotations are merged into the reconciled checklist.
 *
 * Y.js Schema:
 * study.annotations (Y.Map)
 *   [checklistId] (Y.Map)
 *     [annotationId] (Y.Map) { id, type, pageIndex, pdfId, embedPdfData, createdBy, createdAt, updatedAt }
 */

import * as Y from 'yjs';

export interface AnnotationData {
  id?: string;
  type?: string;
  pageIndex?: number;
  pdfId?: string;
  embedPdfData?: string;
  [key: string]: unknown;
}

export interface ParsedAnnotation {
  id: string;
  pdfId: string;
  type: string;
  pageIndex: number;
  embedPdfData: Record<string, unknown>;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  mergedFrom?: string;
  [key: string]: unknown;
}

export interface AnnotationOperations {
  addAnnotation: (
    studyId: string,
    pdfId: string,
    checklistId: string,
    annotationData: AnnotationData,
    userId?: string,
  ) => string | null;
  addAnnotations: (
    studyId: string,
    pdfId: string,
    checklistId: string,
    annotations: AnnotationData[],
    userId?: string,
  ) => string[];
  updateAnnotation: (
    studyId: string,
    checklistId: string,
    annotationId: string,
    annotationData: AnnotationData,
  ) => void;
  deleteAnnotation: (studyId: string, checklistId: string, annotationId: string) => void;
  getAnnotations: (
    studyId: string,
    pdfId: string | undefined,
    checklistId: string,
  ) => ParsedAnnotation[];
  getAllAnnotationsForPdf: (studyId: string, pdfId: string) => Record<string, ParsedAnnotation[]>;
  clearAnnotationsForChecklist: (studyId: string, checklistId: string) => void;
  mergeAnnotations: (
    studyId: string,
    pdfId: string,
    targetChecklistId: string,
    sourceChecklistIds: string[],
    userId: string,
  ) => number;
}

export function createAnnotationOperations(
  _projectId: string,
  getYDoc: () => Y.Doc | null,
  _isSynced: () => boolean,
): AnnotationOperations {
  function getAnnotationsMap(studyId: string, create = false): Y.Map<unknown> | null {
    const ydoc = getYDoc();
    if (!ydoc) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
    if (!studyYMap) return null;

    let annotationsMap = studyYMap.get('annotations') as Y.Map<unknown> | undefined;
    if (!annotationsMap && create) {
      annotationsMap = new Y.Map();
      studyYMap.set('annotations', annotationsMap);
    }
    return annotationsMap ?? null;
  }

  function getChecklistAnnotationsMap(
    studyId: string,
    checklistId: string,
    create = false,
  ): Y.Map<unknown> | null {
    const annotationsMap = getAnnotationsMap(studyId, create);
    if (!annotationsMap) return null;

    let checklistAnnotationsMap = annotationsMap.get(checklistId) as Y.Map<unknown> | undefined;
    if (!checklistAnnotationsMap && create) {
      checklistAnnotationsMap = new Y.Map();
      annotationsMap.set(checklistId, checklistAnnotationsMap);
    }
    return checklistAnnotationsMap ?? null;
  }

  function addAnnotation(
    studyId: string,
    pdfId: string,
    checklistId: string,
    annotationData: AnnotationData,
    userId?: string,
  ): string | null {
    if (!studyId || !pdfId || !checklistId || !annotationData) {
      console.warn('addAnnotation: missing required parameters');
      return null;
    }

    const checklistAnnotationsMap = getChecklistAnnotationsMap(studyId, checklistId, true);
    if (!checklistAnnotationsMap) return null;

    const annotationId = annotationData.id || crypto.randomUUID();
    const annotationYMap = new Y.Map();

    annotationYMap.set('id', annotationId);
    annotationYMap.set('pdfId', pdfId);
    annotationYMap.set('type', annotationData.type);
    annotationYMap.set('pageIndex', annotationData.pageIndex);
    const embedDataWithId = { ...annotationData, id: annotationId };
    annotationYMap.set('embedPdfData', JSON.stringify(embedDataWithId));
    annotationYMap.set('createdBy', userId || 'unknown');
    annotationYMap.set('createdAt', Date.now());
    annotationYMap.set('updatedAt', Date.now());

    checklistAnnotationsMap.set(annotationId, annotationYMap);

    return annotationId;
  }

  function addAnnotations(
    studyId: string,
    pdfId: string,
    checklistId: string,
    annotations: AnnotationData[],
    userId?: string,
  ): string[] {
    const ydoc = getYDoc();
    if (!ydoc || !annotations?.length) return [];

    const ids: string[] = [];
    ydoc.transact(() => {
      for (const annotation of annotations) {
        const id = addAnnotation(studyId, pdfId, checklistId, annotation, userId);
        if (id) ids.push(id);
      }
    });
    return ids;
  }

  function updateAnnotation(
    studyId: string,
    checklistId: string,
    annotationId: string,
    annotationData: AnnotationData,
  ): void {
    const checklistAnnotationsMap = getChecklistAnnotationsMap(studyId, checklistId);
    if (!checklistAnnotationsMap) return;

    const annotationYMap = checklistAnnotationsMap.get(annotationId) as Y.Map<unknown> | undefined;
    if (!annotationYMap) return;

    if (annotationData.type !== undefined) {
      annotationYMap.set('type', annotationData.type);
    }
    if (annotationData.pageIndex !== undefined) {
      annotationYMap.set('pageIndex', annotationData.pageIndex);
    }
    annotationYMap.set('embedPdfData', JSON.stringify(annotationData));
    annotationYMap.set('updatedAt', Date.now());
  }

  function deleteAnnotation(studyId: string, checklistId: string, annotationId: string): void {
    const checklistAnnotationsMap = getChecklistAnnotationsMap(studyId, checklistId);
    if (!checklistAnnotationsMap) return;

    checklistAnnotationsMap.delete(annotationId);
  }

  function getAnnotations(
    studyId: string,
    pdfId: string | undefined,
    checklistId: string,
  ): ParsedAnnotation[] {
    const checklistAnnotationsMap = getChecklistAnnotationsMap(studyId, checklistId);
    if (!checklistAnnotationsMap) return [];

    const annotations: ParsedAnnotation[] = [];
    for (const [_annotationId, annotationYMap] of checklistAnnotationsMap.entries()) {
      const ymap = annotationYMap as Y.Map<unknown>;
      const data = ymap.toJSON ? ymap.toJSON() : (annotationYMap as Record<string, unknown>);

      if (pdfId && data.pdfId !== pdfId) continue;

      let embedPdfData: Record<string, unknown> = {};
      try {
        embedPdfData = JSON.parse((data.embedPdfData as string) || '{}');
      } catch (err) {
        console.warn('Failed to parse annotation embedPdfData:', data.id, err);
      }

      annotations.push({
        ...data,
        embedPdfData,
      } as ParsedAnnotation);
    }

    return annotations;
  }

  function getAllAnnotationsForPdf(
    studyId: string,
    pdfId: string,
  ): Record<string, ParsedAnnotation[]> {
    const annotationsMap = getAnnotationsMap(studyId);
    if (!annotationsMap) return {};

    const result: Record<string, ParsedAnnotation[]> = {};
    for (const [checklistId, checklistAnnotationsMap] of annotationsMap.entries()) {
      const annotations: ParsedAnnotation[] = [];
      const checklistMap = checklistAnnotationsMap as Y.Map<unknown>;
      for (const [_annotationId, annotationYMap] of checklistMap.entries()) {
        const ymap = annotationYMap as Y.Map<unknown>;
        const data = ymap.toJSON ? ymap.toJSON() : (annotationYMap as Record<string, unknown>);

        if (data.pdfId !== pdfId) continue;

        let embedPdfData: Record<string, unknown> = {};
        try {
          embedPdfData = JSON.parse((data.embedPdfData as string) || '{}');
        } catch (err) {
          console.warn('Failed to parse annotation embedPdfData:', data.id, err);
        }

        annotations.push({
          ...data,
          embedPdfData,
        } as ParsedAnnotation);
      }

      if (annotations.length > 0) {
        result[checklistId] = annotations;
      }
    }

    return result;
  }

  function clearAnnotationsForChecklist(studyId: string, checklistId: string): void {
    const annotationsMap = getAnnotationsMap(studyId);
    if (!annotationsMap) return;

    annotationsMap.delete(checklistId);
  }

  function mergeAnnotations(
    studyId: string,
    pdfId: string,
    targetChecklistId: string,
    sourceChecklistIds: string[],
    _userId: string,
  ): number {
    const ydoc = getYDoc();
    if (!ydoc) return 0;

    let mergedCount = 0;
    const targetMap = getChecklistAnnotationsMap(studyId, targetChecklistId, true);
    if (!targetMap) return 0;

    ydoc.transact(() => {
      for (const sourceChecklistId of sourceChecklistIds) {
        const sourceMap = getChecklistAnnotationsMap(studyId, sourceChecklistId);
        if (!sourceMap) continue;

        for (const [_annotationId, annotationYMap] of sourceMap.entries()) {
          const ymap = annotationYMap as Y.Map<unknown>;
          const data = ymap.toJSON ? ymap.toJSON() : (annotationYMap as Record<string, unknown>);

          if (data.pdfId !== pdfId) continue;

          const newAnnotationId = crypto.randomUUID();
          const newAnnotationYMap = new Y.Map();

          newAnnotationYMap.set('id', newAnnotationId);
          newAnnotationYMap.set('pdfId', data.pdfId);
          newAnnotationYMap.set('type', data.type);
          newAnnotationYMap.set('pageIndex', data.pageIndex);
          if (data.embedPdfData) {
            try {
              const parsed =
                typeof data.embedPdfData === 'string' ?
                  JSON.parse(data.embedPdfData)
                : data.embedPdfData;
              const updatedEmbed = { ...parsed, id: newAnnotationId };
              newAnnotationYMap.set('embedPdfData', JSON.stringify(updatedEmbed));
            } catch (parseErr) {
              console.warn(
                '[annotations] Failed to parse embedPdfData during merge, using as-is:',
                parseErr,
              );
              newAnnotationYMap.set('embedPdfData', data.embedPdfData);
            }
          } else {
            newAnnotationYMap.set('embedPdfData', data.embedPdfData);
          }
          newAnnotationYMap.set('createdBy', data.createdBy);
          newAnnotationYMap.set('createdAt', data.createdAt);
          newAnnotationYMap.set('updatedAt', Date.now());
          newAnnotationYMap.set('mergedFrom', sourceChecklistId);

          targetMap.set(newAnnotationId, newAnnotationYMap);
          mergedCount++;
        }
      }
    });

    return mergedCount;
  }

  return {
    addAnnotation,
    addAnnotations,
    updateAnnotation,
    deleteAnnotation,
    getAnnotations,
    getAllAnnotationsForPdf,
    clearAnnotationsForChecklist,
    mergeAnnotations,
  };
}
