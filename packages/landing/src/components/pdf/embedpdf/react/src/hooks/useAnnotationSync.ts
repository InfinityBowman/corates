/**
 * useAnnotationSync - React hook for syncing EmbedPDF annotations with external storage
 *
 * This hook bridges the EmbedPDF annotation plugin with the Y.js persistence layer.
 * It handles:
 * - Loading initial annotations when PDF opens
 * - Detecting annotation changes (add, update, delete)
 * - Calling callbacks to sync changes to Y.js
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAnnotationCapability } from '@embedpdf/plugin-annotation/react';

export interface AnnotationData {
  id: string;
  type?: string;
  pageIndex?: number;
  embedPdfData?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UseAnnotationSyncOptions {
  documentId: string;
  pdfId: string;
  readOnly?: boolean;
  onAnnotationAdd?: (annotation: AnnotationData) => void;
  onAnnotationUpdate?: (annotation: AnnotationData) => void;
  onAnnotationDelete?: (annotationId: string) => void;
  initialAnnotations?: AnnotationData[];
}

export interface UseAnnotationSyncReturn {
  loadAnnotations: (annotations: AnnotationData[]) => Promise<void>;
  isLoaded: boolean;
}

/**
 * Hook to sync EmbedPDF annotations with external storage
 */
export function useAnnotationSync({
  documentId,
  pdfId,
  readOnly = false,
  onAnnotationAdd,
  onAnnotationUpdate,
  onAnnotationDelete,
  initialAnnotations,
}: UseAnnotationSyncOptions): UseAnnotationSyncReturn {
  const { provides: annotationCapability } = useAnnotationCapability();
  const loadedRef = useRef(false);
  const isApplyingRef = useRef(false);
  const annotationMapRef = useRef(new Map<string, AnnotationData>());

  // Get document-scoped annotation API
  const annotationScope = annotationCapability?.forDocument(documentId);

  // The annotation scope API may expose individual event hooks (onAnnotationCreate, etc.)
  // that are not in the base type definition. Cast to any to preserve original behavior.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scopeAny = annotationScope as any;

  /**
   * Load initial annotations into the viewer
   */
  const loadAnnotations = useCallback(
    async (annotations: AnnotationData[]) => {
      if (!annotationScope || !annotations?.length || loadedRef.current) {
        return;
      }

      loadedRef.current = true;
      isApplyingRef.current = true;

      try {
        for (const annotation of annotations) {
          if (!annotation.embedPdfData) continue;

          const embedData = annotation.embedPdfData;
          const annotationId = annotation.id || (embedData.id as string);

          // Track this annotation as known (loaded from storage)
          annotationMapRef.current.set(annotationId, annotation);

          // Create the annotation in the viewer
          try {
            await (annotationScope as any).createAnnotation(embedData.pageIndex as number, {
              ...embedData,
              id: annotationId,
            });
          } catch (err) {
            console.warn('Failed to load annotation:', annotationId, err);
          }
        }
      } finally {
        isApplyingRef.current = false;
      }
    },
    [annotationScope],
  );

  // Load initial annotations when the component mounts and we have the API
  useEffect(() => {
    if (annotationScope && initialAnnotations?.length && !loadedRef.current) {
      loadAnnotations(initialAnnotations);
    }
  }, [annotationScope, initialAnnotations, loadAnnotations]);

  // Reset loaded state when documentId or pdfId changes
  useEffect(() => {
    loadedRef.current = false;
    annotationMapRef.current.clear();
  }, [documentId, pdfId]);

  // Subscribe to annotation changes
  useEffect(() => {
    if (!scopeAny || readOnly) return;

    // Subscribe to annotation creation
    const unsubCreate = scopeAny.onAnnotationCreate?.((event: { annotation: AnnotationData }) => {
      if (isApplyingRef.current) return;

      const annotation = event.annotation;
      const annotationId = annotation.id;

      if (annotationMapRef.current.has(annotationId)) return;

      annotationMapRef.current.set(annotationId, annotation);

      if (onAnnotationAdd) {
        onAnnotationAdd({
          ...annotation,
          id: annotationId,
          type: annotation.type,
          pageIndex: annotation.pageIndex,
        });
      }
    });

    // Subscribe to annotation updates
    const unsubUpdate = scopeAny.onAnnotationUpdate?.((event: { annotation: AnnotationData }) => {
      if (isApplyingRef.current) return;

      const annotation = event.annotation;
      const annotationId = annotation.id;

      annotationMapRef.current.set(annotationId, annotation);

      if (onAnnotationUpdate) {
        onAnnotationUpdate({
          ...annotation,
          id: annotationId,
          type: annotation.type,
          pageIndex: annotation.pageIndex,
        });
      }
    });

    // Subscribe to annotation deletion
    const unsubDelete = scopeAny.onAnnotationDelete?.((event: { annotationId?: string; id?: string }) => {
      if (isApplyingRef.current) return;

      const annotationId = (event.annotationId || event.id)!;

      annotationMapRef.current.delete(annotationId);

      if (onAnnotationDelete) {
        onAnnotationDelete(annotationId);
      }
    });

    return () => {
      unsubCreate?.();
      unsubUpdate?.();
      unsubDelete?.();
    };
  }, [scopeAny, readOnly, onAnnotationAdd, onAnnotationUpdate, onAnnotationDelete]);

  return {
    loadAnnotations,
    isLoaded: loadedRef.current,
  };
}

export default useAnnotationSync;
