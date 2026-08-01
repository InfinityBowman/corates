import { useMemo } from 'react';
import { useLiveQuery, eq } from '@tanstack/react-db';
import { useProjectCollections } from '@/project/workspace-data';
import { emptyCollections } from '@/project/localCollections';
import type { AnnotationEntry } from '@/stores/projectStore';

const EMPTY: AnnotationEntry[] = [];

export function useStudyAnnotations(
  projectId: string,
  _studyId: string,
  checklistId: string,
  pdfId: string | null,
): AnnotationEntry[] {
  const collections = useProjectCollections(projectId) ?? emptyCollections;

  const { data } = useLiveQuery(
    q =>
      q
        .from({ annotation: collections.annotations })
        .where(({ annotation }) => eq(annotation.checklistId, checklistId)),
    [collections, checklistId],
  );

  return useMemo(() => {
    if (!pdfId) return EMPTY;

    const result: AnnotationEntry[] = [];
    for (const row of data ?? []) {
      if (row.pdfId !== pdfId) continue;

      let embedPdfData: Record<string, unknown> = {};
      try {
        embedPdfData = JSON.parse(row.embedPdfData || '{}');
      } catch {
        // ignore parse failures
      }

      result.push({
        id: row.id,
        pdfId: row.pdfId,
        type: row.type,
        pageIndex: row.pageIndex,
        embedPdfData,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        mergedFrom: row.mergedFrom ?? null,
      });
    }
    return result;
  }, [data, pdfId]);
}
