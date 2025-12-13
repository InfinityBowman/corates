/**
 * Reconciliation progress operations for useProject
 */

import * as Y from 'yjs';

/**
 * Creates reconciliation operations
 * @param {string} projectId - The project ID
 * @param {Function} getYDoc - Function that returns the Y.Doc
 * @param {Function} isSynced - Function that returns sync status
 * @returns {Object} Reconciliation operations
 */
export function createReconciliationOperations(projectId, getYDoc, isSynced) {
  /**
   * Save reconciliation progress for a study
   * @param {string} studyId - The study ID
   * @param {Object} progressData - Progress data { checklist1Id, checklist2Id, currentPage, viewMode, finalAnswers }
   */
  function saveReconciliationProgress(studyId, progressData) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    // Store reconciliation progress as a Y.Map
    let reconciliationMap = studyYMap.get('reconciliation');
    if (!reconciliationMap) {
      reconciliationMap = new Y.Map();
      studyYMap.set('reconciliation', reconciliationMap);
    }

    // Save the progress data
    reconciliationMap.set('checklist1Id', progressData.checklist1Id);
    reconciliationMap.set('checklist2Id', progressData.checklist2Id);
    reconciliationMap.set('currentPage', progressData.currentPage);
    reconciliationMap.set('viewMode', progressData.viewMode || 'questions');
    reconciliationMap.set('finalAnswers', JSON.stringify(progressData.finalAnswers || {}));
    reconciliationMap.set('updatedAt', Date.now());

    studyYMap.set('updatedAt', Date.now());
  }

  /**
   * Get reconciliation progress for a study
   * @param {string} studyId - The study ID
   * @returns {Object|null} Progress data or null
   */
  function getReconciliationProgress(studyId) {
    const ydoc = getYDoc();
    if (!ydoc) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return null;

    const reconciliationMap = studyYMap.get('reconciliation');
    if (!reconciliationMap) return null;

    const data = reconciliationMap.toJSON ? reconciliationMap.toJSON() : {};
    if (!data.checklist1Id || !data.checklist2Id) return null;

    return {
      checklist1Id: data.checklist1Id,
      checklist2Id: data.checklist2Id,
      currentPage: data.currentPage || 0,
      viewMode: data.viewMode || 'questions',
      finalAnswers: data.finalAnswers ? JSON.parse(data.finalAnswers) : {},
      updatedAt: data.updatedAt,
    };
  }

  /**
   * Clear reconciliation progress for a study
   * @param {string} studyId - The study ID
   */
  function clearReconciliationProgress(studyId) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    studyYMap.delete('reconciliation');
    studyYMap.set('updatedAt', Date.now());
  }

  return {
    saveReconciliationProgress,
    getReconciliationProgress,
    clearReconciliationProgress,
  };
}
