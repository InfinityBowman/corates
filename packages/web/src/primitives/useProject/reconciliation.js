/**
 * Reconciliation progress operations for useProject
 *
 * Note: finalAnswers are stored as a nested Y.Map structure to enable
 * collaborative editing of notes during reconciliation.
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
   * Uses Y.Map for finalAnswers to enable collaborative note editing
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
    reconciliationMap.set('updatedAt', Date.now());

    // Store finalAnswers as a nested Y.Map for collaborative editing
    let finalAnswersMap = reconciliationMap.get('finalAnswers');
    if (!finalAnswersMap || !(finalAnswersMap instanceof Y.Map)) {
      finalAnswersMap = new Y.Map();
      reconciliationMap.set('finalAnswers', finalAnswersMap);
    }

    // Update each question's answers
    const finalAnswers = progressData.finalAnswers || {};
    for (const [questionKey, questionData] of Object.entries(finalAnswers)) {
      let questionYMap = finalAnswersMap.get(questionKey);
      if (!questionYMap || !(questionYMap instanceof Y.Map)) {
        questionYMap = new Y.Map();
        finalAnswersMap.set(questionKey, questionYMap);
      }

      // Store answers and critical flag
      if (questionData.answers !== undefined) {
        questionYMap.set('answers', questionData.answers);
      }
      if (questionData.critical !== undefined) {
        questionYMap.set('critical', questionData.critical);
      }

      // Initialize Y.Text for note if not present (for collaborative editing)
      if (!questionYMap.get('note')) {
        questionYMap.set('note', new Y.Text());
      }
    }

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

    const checklist1Id = reconciliationMap.get('checklist1Id');
    const checklist2Id = reconciliationMap.get('checklist2Id');
    if (!checklist1Id || !checklist2Id) return null;

    // Extract finalAnswers from Y.Map structure
    const finalAnswers = {};
    const finalAnswersMap = reconciliationMap.get('finalAnswers');
    if (finalAnswersMap && finalAnswersMap instanceof Y.Map) {
      for (const [questionKey, questionYMap] of finalAnswersMap.entries()) {
        if (questionYMap instanceof Y.Map) {
          finalAnswers[questionKey] = {
            answers: questionYMap.get('answers'),
            critical: questionYMap.get('critical'),
            // Note: Y.Text note is accessed separately via getReconciliationNote
          };
        }
      }
    }

    return {
      checklist1Id,
      checklist2Id,
      currentPage: reconciliationMap.get('currentPage') || 0,
      viewMode: reconciliationMap.get('viewMode') || 'questions',
      finalAnswers,
      updatedAt: reconciliationMap.get('updatedAt'),
    };
  }

  /**
   * Get a Y.Text reference for a reconciliation note (for direct binding)
   * @param {string} studyId - The study ID
   * @param {string} questionKey - The question key (e.g., 'q1', 'q9')
   * @returns {Y.Text|null} The Y.Text reference or null
   */
  function getReconciliationNote(studyId, questionKey) {
    const ydoc = getYDoc();
    if (!ydoc) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return null;

    // Create reconciliation map if it doesn't exist
    let reconciliationMap = studyYMap.get('reconciliation');
    if (!reconciliationMap) {
      if (!isSynced()) return null;
      reconciliationMap = new Y.Map();
      studyYMap.set('reconciliation', reconciliationMap);
    }

    // Create finalAnswers map if it doesn't exist
    let finalAnswersMap = reconciliationMap.get('finalAnswers');
    if (!finalAnswersMap || !(finalAnswersMap instanceof Y.Map)) {
      if (!isSynced()) return null;
      finalAnswersMap = new Y.Map();
      reconciliationMap.set('finalAnswers', finalAnswersMap);
    }

    let questionYMap = finalAnswersMap.get(questionKey);
    if (!questionYMap || !(questionYMap instanceof Y.Map)) {
      // Create the question map if it doesn't exist
      if (isSynced()) {
        questionYMap = new Y.Map();
        questionYMap.set('note', new Y.Text());
        finalAnswersMap.set(questionKey, questionYMap);
        return questionYMap.get('note');
      }
      return null;
    }

    let note = questionYMap.get('note');
    if (note instanceof Y.Text) {
      return note;
    }

    // Create note if missing
    if (isSynced()) {
      note = new Y.Text();
      questionYMap.set('note', note);
      return note;
    }

    return null;
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
    getReconciliationNote,
    clearReconciliationProgress,
  };
}
