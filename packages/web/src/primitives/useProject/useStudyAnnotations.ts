import { useCallback, useRef, useSyncExternalStore } from 'react';
import * as Y from 'yjs';
import { connectionPool } from '@/project/ConnectionPool';
import type { AnnotationEntry } from '@/stores/projectStore';

function resolveAnnotationsMap(ydoc: Y.Doc | null, studyId: string): Y.Map<unknown> | null {
  if (!ydoc) return null;
  const studiesMap = ydoc.getMap('reviews');
  const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
  if (!studyYMap) return null;
  return (studyYMap.get('annotations') as Y.Map<unknown>) ?? null;
}

function serializeForChecklist(
  annotationsMap: Y.Map<unknown>,
  checklistId: string,
  pdfId: string,
): AnnotationEntry[] {
  const checklistAnnotationsMap = annotationsMap.get(checklistId) as Y.Map<unknown> | undefined;
  if (!checklistAnnotationsMap || typeof checklistAnnotationsMap.entries !== 'function') return [];

  const result: AnnotationEntry[] = [];
  for (const [annotationId, annotationYMap] of checklistAnnotationsMap.entries()) {
    if (!annotationYMap) continue;
    const ymap = annotationYMap as { toJSON?: () => Record<string, unknown> };
    const data = ymap.toJSON ? ymap.toJSON() : (annotationYMap as Record<string, unknown>);

    if (data.pdfId !== pdfId) continue;

    let embedPdfData: Record<string, unknown> = {};
    try {
      embedPdfData = JSON.parse((data.embedPdfData as string) || '{}');
    } catch {
      // ignore parse failures
    }

    result.push({
      id: (data.id as string) || annotationId,
      pdfId: data.pdfId as string,
      type: data.type as string,
      pageIndex: data.pageIndex as number,
      embedPdfData,
      createdBy: data.createdBy as string,
      createdAt: data.createdAt as number,
      updatedAt: data.updatedAt as number,
      mergedFrom: (data.mergedFrom as string) || null,
    });
  }
  return result;
}

const EMPTY: AnnotationEntry[] = [];

export function useStudyAnnotations(
  projectId: string,
  studyId: string,
  checklistId: string,
  pdfId: string | null,
): AnnotationEntry[] {
  const ydoc = connectionPool.getEntry(projectId)?.ydoc ?? null;

  const versionRef = useRef(0);
  const cacheRef = useRef<{
    version: number;
    checklistId: string | null;
    pdfId: string | null;
    value: AnnotationEntry[];
  }>({ version: -1, checklistId: null, pdfId: null, value: EMPTY });

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!ydoc) return () => {};
      const annotationsMap = resolveAnnotationsMap(ydoc, studyId);
      if (!annotationsMap) {
        // Annotations map doesn't exist yet — observe the study to catch when it's created
        const studiesMap = ydoc.getMap('reviews');
        const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
        if (!studyYMap) return () => {};
        const observer = () => {
          versionRef.current += 1;
          onStoreChange();
        };
        studyYMap.observe(observer);
        return () => studyYMap.unobserve(observer);
      }
      const observer = () => {
        versionRef.current += 1;
        onStoreChange();
      };
      annotationsMap.observeDeep(observer);
      return () => annotationsMap.unobserveDeep(observer);
    },
    [ydoc, studyId],
  );

  const getSnapshot = useCallback((): AnnotationEntry[] => {
    if (!pdfId) return EMPTY;
    const cached = cacheRef.current;
    if (
      cached.version === versionRef.current &&
      cached.checklistId === checklistId &&
      cached.pdfId === pdfId
    ) {
      return cached.value;
    }

    const annotationsMap = resolveAnnotationsMap(ydoc, studyId);
    if (!annotationsMap) {
      cacheRef.current = { version: versionRef.current, checklistId, pdfId, value: EMPTY };
      return EMPTY;
    }

    const value = serializeForChecklist(annotationsMap, checklistId, pdfId);
    cacheRef.current = { version: versionRef.current, checklistId, pdfId, value };
    return value;
  }, [ydoc, studyId, checklistId, pdfId]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
