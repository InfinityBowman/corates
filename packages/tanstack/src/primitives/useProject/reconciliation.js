/**
 * Reconciliation progress operations for useProject
 *
 * Note: finalAnswers are now stored in a third checklist (reconciled checklist)
 * that both reviewers can edit. This leverages existing checklist infrastructure
 * for automatic Yjs sync. Reconciliation progress only stores metadata references.
 */

import * as Y from 'yjs'

/**
 * Creates reconciliation operations
 * @param {string} projectId - The project ID
 * @param {Function} getYDoc - Function that returns the Y.Doc
 * @param {Function} isSynced - Function that returns sync status
 * @returns {Object} Reconciliation operations
 */
export function createReconciliationOperations(projectId, getYDoc, _isSynced) {
  /**
   * Save reconciliation progress for a study
   * Stores only metadata references - finalAnswers are in the reconciled checklist
   * @param {string} studyId - The study ID
   * @param {Object} progressData - Progress data { checklist1Id, checklist2Id, reconciledChecklistId }
   */
  function saveReconciliationProgress(studyId, progressData) {
    const ydoc = getYDoc()
    if (!ydoc) return

    const studiesMap = ydoc.getMap('reviews')
    const studyYMap = studiesMap.get(studyId)
    if (!studyYMap) return

    // Store reconciliation progress as a Y.Map
    let reconciliationMap = studyYMap.get('reconciliation')
    if (!reconciliationMap) {
      reconciliationMap = new Y.Map()
      studyYMap.set('reconciliation', reconciliationMap)
    }

    // Save the progress data (minimal - just references)
    reconciliationMap.set('checklist1Id', progressData.checklist1Id)
    reconciliationMap.set('checklist2Id', progressData.checklist2Id)
    if (progressData.reconciledChecklistId) {
      reconciliationMap.set(
        'reconciledChecklistId',
        progressData.reconciledChecklistId,
      )
    }
    if (progressData.currentPage !== undefined) {
      reconciliationMap.set('currentPage', progressData.currentPage)
    }
    if (progressData.viewMode !== undefined) {
      reconciliationMap.set('viewMode', progressData.viewMode)
    }
    reconciliationMap.set('updatedAt', Date.now())

    studyYMap.set('updatedAt', Date.now())
  }

  /**
   * Get reconciliation progress for a study
   * @param {string} studyId - The study ID
   * @returns {Object|null} Progress data or null
   */
  function getReconciliationProgress(studyId) {
    const ydoc = getYDoc()
    if (!ydoc) return null

    const studiesMap = ydoc.getMap('reviews')
    const studyYMap = studiesMap.get(studyId)
    if (!studyYMap) return null

    const reconciliationMap = studyYMap.get('reconciliation')
    if (!reconciliationMap) return null

    const checklist1Id = reconciliationMap.get('checklist1Id')
    const checklist2Id = reconciliationMap.get('checklist2Id')
    if (!checklist1Id || !checklist2Id) return null

    return {
      checklist1Id,
      checklist2Id,
      reconciledChecklistId:
        reconciliationMap.get('reconciledChecklistId') || null,
      currentPage: reconciliationMap.get('currentPage'),
      viewMode: reconciliationMap.get('viewMode'),
      updatedAt: reconciliationMap.get('updatedAt'),
    }
  }

  /**
   * Clear reconciliation progress for a study
   * @param {string} studyId - The study ID
   */
  function clearReconciliationProgress(studyId) {
    const ydoc = getYDoc()
    if (!ydoc) return

    const studiesMap = ydoc.getMap('reviews')
    const studyYMap = studiesMap.get(studyId)
    if (!studyYMap) return

    studyYMap.delete('reconciliation')
    studyYMap.set('updatedAt', Date.now())
  }

  return {
    saveReconciliationProgress,
    getReconciliationProgress,
    clearReconciliationProgress,
  }
}
