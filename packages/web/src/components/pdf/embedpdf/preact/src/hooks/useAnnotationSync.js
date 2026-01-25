/**
 * useAnnotationSync - Preact hook for syncing EmbedPDF annotations with external storage
 *
 * This hook bridges the EmbedPDF annotation plugin with the Y.js persistence layer.
 * It handles:
 * - Loading initial annotations when PDF opens
 * - Detecting annotation changes (add, update, delete)
 * - Calling callbacks to sync changes to Y.js
 */

import { useEffect, useRef, useCallback } from 'preact/hooks';
import { useAnnotationCapability } from '@embedpdf/plugin-annotation/react';

/**
 * @typedef {Object} AnnotationChange
 * @property {'add' | 'update' | 'delete'} type - Type of change
 * @property {string} id - Annotation ID
 * @property {Object} [data] - Annotation data (for add/update)
 */

/**
 * Hook to sync EmbedPDF annotations with external storage
 * @param {Object} options
 * @param {string} options.documentId - Active document ID
 * @param {string} options.pdfId - Current PDF ID
 * @param {boolean} options.readOnly - Whether annotations are read-only
 * @param {Function} options.onAnnotationAdd - Callback when annotation is added
 * @param {Function} options.onAnnotationUpdate - Callback when annotation is updated
 * @param {Function} options.onAnnotationDelete - Callback when annotation is deleted
 * @param {Array} options.initialAnnotations - Annotations to load on mount
 */
export function useAnnotationSync({
  documentId,
  pdfId,
  readOnly = false,
  onAnnotationAdd,
  onAnnotationUpdate,
  onAnnotationDelete,
  initialAnnotations,
}) {
  const { provides: annotationCapability } = useAnnotationCapability();
  const loadedRef = useRef(false);
  const isApplyingRef = useRef(false);
  const annotationMapRef = useRef(new Map()); // Track known annotations by ID

  // Get document-scoped annotation API
  const annotationScope = annotationCapability?.forDocument(documentId);

  /**
   * Load initial annotations into the viewer
   */
  const loadAnnotations = useCallback(
    async annotations => {
      if (!annotationScope || !annotations?.length || loadedRef.current) {
        return;
      }

      loadedRef.current = true;
      isApplyingRef.current = true;

      try {
        for (const annotation of annotations) {
          if (!annotation.embedPdfData) continue;

          const embedData = annotation.embedPdfData;
          // Use the annotation ID from storage, or the one in embedPdfData
          const annotationId = annotation.id || embedData.id;

          // Track this annotation as known (loaded from storage)
          annotationMapRef.current.set(annotationId, annotation);

          // Create the annotation in the viewer
          // The EmbedPDF plugin should handle the annotation creation
          try {
            await annotationScope.createAnnotation(embedData.pageIndex, {
              ...embedData,
              id: annotationId,
            });
          } catch (err) {
            // Annotation might already exist or have invalid data
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
    if (!annotationScope || readOnly) return;

    // Subscribe to annotation creation
    const unsubCreate = annotationScope.onAnnotationCreate?.(event => {
      // Skip if we're applying stored annotations
      if (isApplyingRef.current) return;

      const annotation = event.annotation;
      const annotationId = annotation.id;

      // Skip if this annotation was loaded from storage
      if (annotationMapRef.current.has(annotationId)) return;

      // Track this new annotation
      annotationMapRef.current.set(annotationId, annotation);

      // Notify external storage
      if (onAnnotationAdd) {
        onAnnotationAdd({
          id: annotationId,
          type: annotation.type,
          pageIndex: annotation.pageIndex,
          ...annotation,
        });
      }
    });

    // Subscribe to annotation updates
    const unsubUpdate = annotationScope.onAnnotationUpdate?.(event => {
      // Skip if we're applying stored annotations
      if (isApplyingRef.current) return;

      const annotation = event.annotation;
      const annotationId = annotation.id;

      // Update tracking
      annotationMapRef.current.set(annotationId, annotation);

      // Notify external storage
      if (onAnnotationUpdate) {
        onAnnotationUpdate({
          id: annotationId,
          type: annotation.type,
          pageIndex: annotation.pageIndex,
          ...annotation,
        });
      }
    });

    // Subscribe to annotation deletion
    const unsubDelete = annotationScope.onAnnotationDelete?.(event => {
      // Skip if we're applying stored annotations
      if (isApplyingRef.current) return;

      const annotationId = event.annotationId || event.id;

      // Remove from tracking
      annotationMapRef.current.delete(annotationId);

      // Notify external storage
      if (onAnnotationDelete) {
        onAnnotationDelete(annotationId);
      }
    });

    return () => {
      unsubCreate?.();
      unsubUpdate?.();
      unsubDelete?.();
    };
  }, [annotationScope, readOnly, onAnnotationAdd, onAnnotationUpdate, onAnnotationDelete]);

  return {
    loadAnnotations,
    isLoaded: loadedRef.current,
  };
}

export default useAnnotationSync;
