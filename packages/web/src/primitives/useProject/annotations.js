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

/**
 * Creates annotation operations for a project
 * @param {string} projectId - The project ID
 * @param {Function} getYDoc - Function that returns the Y.Doc
 * @param {Function} isSynced - Function that returns sync status
 * @returns {Object} Annotation operations
 */
export function createAnnotationOperations(projectId, getYDoc, _isSynced) {
  /**
   * Get the annotations Y.Map for a study, creating it if needed
   * @private
   */
  function getAnnotationsMap(studyId, create = false) {
    const ydoc = getYDoc();
    if (!ydoc) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return null;

    let annotationsMap = studyYMap.get('annotations');
    if (!annotationsMap && create) {
      annotationsMap = new Y.Map();
      studyYMap.set('annotations', annotationsMap);
    }
    return annotationsMap;
  }

  /**
   * Get the checklist annotations Y.Map, creating it if needed
   * @private
   */
  function getChecklistAnnotationsMap(studyId, checklistId, create = false) {
    const annotationsMap = getAnnotationsMap(studyId, create);
    if (!annotationsMap) return null;

    let checklistAnnotationsMap = annotationsMap.get(checklistId);
    if (!checklistAnnotationsMap && create) {
      checklistAnnotationsMap = new Y.Map();
      annotationsMap.set(checklistId, checklistAnnotationsMap);
    }
    return checklistAnnotationsMap;
  }

  /**
   * Add a single annotation
   * @param {string} studyId - The study ID
   * @param {string} pdfId - The PDF ID this annotation belongs to
   * @param {string} checklistId - The checklist ID (determines ownership)
   * @param {Object} annotationData - Annotation data from EmbedPDF
   * @param {string} [userId] - The user creating the annotation (defaults to 'unknown')
   * @returns {string|null} The annotation ID or null if failed
   */
  function addAnnotation(studyId, pdfId, checklistId, annotationData, userId) {
    console.log('[annotations.js] addAnnotation called:', {
      studyId,
      pdfId,
      checklistId,
      annotationData,
      userId,
    });
    if (!studyId || !pdfId || !checklistId || !annotationData) {
      console.warn('addAnnotation: missing required parameters');
      return null;
    }

    const checklistAnnotationsMap = getChecklistAnnotationsMap(studyId, checklistId, true);
    console.log('[annotations.js] checklistAnnotationsMap:', checklistAnnotationsMap);
    if (!checklistAnnotationsMap) return null;

    const annotationId = annotationData.id || crypto.randomUUID();
    const annotationYMap = new Y.Map();

    annotationYMap.set('id', annotationId);
    annotationYMap.set('pdfId', pdfId);
    annotationYMap.set('type', annotationData.type);
    annotationYMap.set('pageIndex', annotationData.pageIndex);
    // Store the full EmbedPDF data as JSON string for restoration
    // Ensure the ID in embedPdfData matches the stored ID
    const embedDataWithId = { ...annotationData, id: annotationId };
    annotationYMap.set('embedPdfData', JSON.stringify(embedDataWithId));
    annotationYMap.set('createdBy', userId || 'unknown');
    annotationYMap.set('createdAt', Date.now());
    annotationYMap.set('updatedAt', Date.now());

    checklistAnnotationsMap.set(annotationId, annotationYMap);

    console.log('[annotations.js] Annotation stored successfully:', annotationId);
    return annotationId;
  }

  /**
   * Add multiple annotations at once (for bulk import)
   * @param {string} studyId - The study ID
   * @param {string} pdfId - The PDF ID
   * @param {string} checklistId - The checklist ID
   * @param {Array} annotations - Array of annotation data objects
   * @param {string} [userId] - The user creating the annotations (defaults to 'unknown')
   * @returns {Array<string>} Array of created annotation IDs
   */
  function addAnnotations(studyId, pdfId, checklistId, annotations, userId) {
    const ydoc = getYDoc();
    if (!ydoc || !annotations?.length) return [];

    const ids = [];
    // Use transaction for atomic bulk insert
    ydoc.transact(() => {
      for (const annotation of annotations) {
        const id = addAnnotation(studyId, pdfId, checklistId, annotation, userId);
        if (id) ids.push(id);
      }
    });
    return ids;
  }

  /**
   * Update an existing annotation
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   * @param {string} annotationId - The annotation ID
   * @param {Object} annotationData - Updated annotation data from EmbedPDF
   */
  function updateAnnotation(studyId, checklistId, annotationId, annotationData) {
    const checklistAnnotationsMap = getChecklistAnnotationsMap(studyId, checklistId);
    if (!checklistAnnotationsMap) return;

    const annotationYMap = checklistAnnotationsMap.get(annotationId);
    if (!annotationYMap) return;

    // Update fields that might have changed
    if (annotationData.type !== undefined) {
      annotationYMap.set('type', annotationData.type);
    }
    if (annotationData.pageIndex !== undefined) {
      annotationYMap.set('pageIndex', annotationData.pageIndex);
    }
    // Always update the full EmbedPDF data
    annotationYMap.set('embedPdfData', JSON.stringify(annotationData));
    annotationYMap.set('updatedAt', Date.now());
  }

  /**
   * Delete an annotation
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   * @param {string} annotationId - The annotation ID
   */
  function deleteAnnotation(studyId, checklistId, annotationId) {
    const checklistAnnotationsMap = getChecklistAnnotationsMap(studyId, checklistId);
    if (!checklistAnnotationsMap) return;

    checklistAnnotationsMap.delete(annotationId);
  }

  /**
   * Get all annotations for a specific checklist and PDF
   * @param {string} studyId - The study ID
   * @param {string} pdfId - The PDF ID (optional, filters by PDF)
   * @param {string} checklistId - The checklist ID
   * @returns {Array} Array of annotation objects
   */
  function getAnnotations(studyId, pdfId, checklistId) {
    const checklistAnnotationsMap = getChecklistAnnotationsMap(studyId, checklistId);
    if (!checklistAnnotationsMap) return [];

    const annotations = [];
    for (const [_annotationId, annotationYMap] of checklistAnnotationsMap.entries()) {
      const data = annotationYMap.toJSON ? annotationYMap.toJSON() : annotationYMap;

      // Filter by pdfId if provided
      if (pdfId && data.pdfId !== pdfId) continue;

      // Parse the stored EmbedPDF data
      let embedPdfData = {};
      try {
        embedPdfData = JSON.parse(data.embedPdfData || '{}');
      } catch (err) {
        console.warn('Failed to parse annotation embedPdfData:', data.id, err);
      }

      annotations.push({
        ...data,
        embedPdfData,
      });
    }

    return annotations;
  }

  /**
   * Get all annotations for a PDF across all checklists
   * Useful for reconciliation view to see both reviewers' annotations
   * @param {string} studyId - The study ID
   * @param {string} pdfId - The PDF ID
   * @returns {Object} Map of checklistId -> annotations array
   */
  function getAllAnnotationsForPdf(studyId, pdfId) {
    const annotationsMap = getAnnotationsMap(studyId);
    if (!annotationsMap) return {};

    const result = {};
    for (const [checklistId, checklistAnnotationsMap] of annotationsMap.entries()) {
      const annotations = [];
      for (const [_annotationId, annotationYMap] of checklistAnnotationsMap.entries()) {
        const data = annotationYMap.toJSON ? annotationYMap.toJSON() : annotationYMap;

        // Filter by pdfId
        if (data.pdfId !== pdfId) continue;

        let embedPdfData = {};
        try {
          embedPdfData = JSON.parse(data.embedPdfData || '{}');
        } catch (err) {
          console.warn('Failed to parse annotation embedPdfData:', data.id, err);
        }

        annotations.push({
          ...data,
          embedPdfData,
        });
      }

      if (annotations.length > 0) {
        result[checklistId] = annotations;
      }
    }

    return result;
  }

  /**
   * Clear all annotations for a checklist
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   */
  function clearAnnotationsForChecklist(studyId, checklistId) {
    const annotationsMap = getAnnotationsMap(studyId);
    if (!annotationsMap) return;

    annotationsMap.delete(checklistId);
  }

  /**
   * Merge annotations from source checklists into a target checklist
   * Used during reconciliation to auto-merge both reviewers' annotations
   * @param {string} studyId - The study ID
   * @param {string} pdfId - The PDF ID
   * @param {string} targetChecklistId - The reconciled checklist ID
   * @param {Array<string>} sourceChecklistIds - Array of checklist IDs to merge from
   * @param {string} userId - The user performing the merge
   * @returns {number} Number of annotations merged
   */
  function mergeAnnotations(studyId, pdfId, targetChecklistId, sourceChecklistIds, _userId) {
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
          const data = annotationYMap.toJSON ? annotationYMap.toJSON() : annotationYMap;

          // Only merge annotations for the specified PDF
          if (data.pdfId !== pdfId) continue;

          // Create a new annotation in the target with a new ID
          // This prevents conflicts if the same annotation exists in multiple sources
          const newAnnotationId = crypto.randomUUID();
          const newAnnotationYMap = new Y.Map();

          newAnnotationYMap.set('id', newAnnotationId);
          newAnnotationYMap.set('pdfId', data.pdfId);
          newAnnotationYMap.set('type', data.type);
          newAnnotationYMap.set('pageIndex', data.pageIndex);
          // Update embedPdfData id to match newAnnotationId (mirrors addAnnotation behavior)
          if (data.embedPdfData) {
            try {
              const parsed =
                typeof data.embedPdfData === 'string'
                  ? JSON.parse(data.embedPdfData)
                  : data.embedPdfData;
              const updatedEmbed = { ...parsed, id: newAnnotationId };
              newAnnotationYMap.set('embedPdfData', JSON.stringify(updatedEmbed));
            } catch (parseErr) {
              console.warn('[annotations.js] Failed to parse embedPdfData during merge, using as-is:', parseErr);
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
