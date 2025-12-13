/**
 * Checklist operations for useProject
 */

import * as Y from 'yjs';
import { createChecklist as createAMSTAR2Answers } from '../../AMSTAR2/checklist.js';

/**
 * Creates checklist operations
 * @param {string} projectId - The project ID
 * @param {Function} getYDoc - Function that returns the Y.Doc
 * @param {Function} isSynced - Function that returns sync status
 * @returns {Object} Checklist operations
 */
export function createChecklistOperations(projectId, getYDoc, isSynced) {
  /**
   * Create a checklist in a study
   * @param {string} studyId - The study ID
   * @param {string} type - Checklist type (default: 'AMSTAR2')
   * @param {string|null} assignedTo - User ID to assign to
   * @returns {string|null} The checklist ID or null if failed
   */
  function createChecklist(studyId, type = 'AMSTAR2', assignedTo = null) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);

    if (!studyYMap) return null;

    let checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) {
      checklistsMap = new Y.Map();
      studyYMap.set('checklists', checklistsMap);
    }

    const checklistId = crypto.randomUUID();
    const now = Date.now();

    // Get the default answers structure for this checklist type
    let answersData = {};
    if (type === 'AMSTAR2') {
      const amstar2 = createAMSTAR2Answers({
        id: checklistId,
        name: `${type} Checklist`,
        createdAt: now,
      });
      // Extract only the question answers (q1, q2, etc.)
      Object.entries(amstar2).forEach(([key, value]) => {
        if (/^q\d+[a-z]*$/i.test(key)) {
          answersData[key] = value;
        }
      });
    }

    const checklistYMap = new Y.Map();
    checklistYMap.set('type', type);
    checklistYMap.set('assignedTo', assignedTo);
    checklistYMap.set('status', 'pending');
    checklistYMap.set('createdAt', now);
    checklistYMap.set('updatedAt', now);

    // Store answers as a Y.Map with each question as a nested Y.Map
    const answersYMap = new Y.Map();
    Object.entries(answersData).forEach(([questionKey, questionData]) => {
      const questionYMap = new Y.Map();
      questionYMap.set('answers', questionData.answers);
      questionYMap.set('critical', questionData.critical);
      answersYMap.set(questionKey, questionYMap);
    });
    checklistYMap.set('answers', answersYMap);

    checklistsMap.set(checklistId, checklistYMap);

    // Update study's updatedAt
    studyYMap.set('updatedAt', now);

    return checklistId;
  }

  /**
   * Update a checklist
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   * @param {Object} updates - Fields to update
   */
  function updateChecklist(studyId, checklistId, updates) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    const checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) return;

    const checklistYMap = checklistsMap.get(checklistId);
    if (!checklistYMap) return;

    if (updates.title !== undefined) checklistYMap.set('title', updates.title);
    if (updates.assignedTo !== undefined) checklistYMap.set('assignedTo', updates.assignedTo);
    if (updates.status !== undefined) checklistYMap.set('status', updates.status);
    checklistYMap.set('updatedAt', Date.now());
  }

  /**
   * Delete a checklist
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   */
  function deleteChecklist(studyId, checklistId) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    const checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) return;

    checklistsMap.delete(checklistId);
    studyYMap.set('updatedAt', Date.now());
  }

  /**
   * Get a specific checklist's Y.Map for answer updates
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   * @returns {Y.Map|null} The answers Y.Map or null
   */
  function getChecklistAnswersMap(studyId, checklistId) {
    const ydoc = getYDoc();
    if (!ydoc) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return null;

    const checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) return null;

    const checklistYMap = checklistsMap.get(checklistId);
    if (!checklistYMap) return null;

    return checklistYMap.get('answers');
  }

  /**
   * Get full checklist data including answers in plain object format
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   * @returns {Object|null} The checklist data or null
   */
  function getChecklistData(studyId, checklistId) {
    const ydoc = getYDoc();
    if (!ydoc) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return null;

    const checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) return null;

    const checklistYMap = checklistsMap.get(checklistId);
    if (!checklistYMap) return null;

    const data = checklistYMap.toJSON ? checklistYMap.toJSON() : {};

    // Convert answers Y.Map to plain object with question keys at top level
    const answers = {};
    const answersMap = checklistYMap.get('answers');
    if (answersMap && typeof answersMap.entries === 'function') {
      for (const [questionKey, questionYMap] of answersMap.entries()) {
        const questionData = questionYMap.toJSON ? questionYMap.toJSON() : questionYMap;
        answers[questionKey] = questionData;
      }
    }

    return {
      ...data,
      answers,
    };
  }

  /**
   * Update a single answer in a checklist
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   * @param {string} questionKey - The question key (e.g., 'q1', 'q2a')
   * @param {Object} answerData - The answer data { answers, critical }
   */
  function updateChecklistAnswer(studyId, checklistId, questionKey, answerData) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    const checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) return;

    const checklistYMap = checklistsMap.get(checklistId);
    if (!checklistYMap) return;

    let answersMap = checklistYMap.get('answers');
    if (!answersMap) {
      answersMap = new Y.Map();
      checklistYMap.set('answers', answersMap);
    }

    // Update the specific question's answer
    const questionYMap = new Y.Map();
    questionYMap.set('answers', answerData.answers);
    questionYMap.set('critical', answerData.critical);
    answersMap.set(questionKey, questionYMap);

    checklistYMap.set('updatedAt', Date.now());
  }

  return {
    createChecklist,
    updateChecklist,
    deleteChecklist,
    getChecklistAnswersMap,
    getChecklistData,
    updateChecklistAnswer,
  };
}
