/**
 * Checklist operations for useProject
 */

import * as Y from 'yjs';
import { createChecklistOfType, CHECKLIST_TYPES } from '@/checklist-registry';

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

    // Get the default answers structure for this checklist type using the registry
    let answersData = {};
    const checklistTemplate = createChecklistOfType(type, {
      id: checklistId,
      name: `${type} Checklist`,
      createdAt: now,
    });

    // Extract answers based on checklist type
    if (type === CHECKLIST_TYPES.AMSTAR2) {
      // AMSTAR2: Extract question answers (q1, q2, etc.)
      Object.entries(checklistTemplate).forEach(([key, value]) => {
        if (/^q\d+[a-z]*$/i.test(key)) {
          answersData[key] = value;
        }
      });
    } else if (type === CHECKLIST_TYPES.ROBINS_I) {
      // ROBINS-I: Extract all domain and section data
      const robinsKeys = [
        'planning',
        'sectionA',
        'sectionB',
        'sectionC',
        'sectionD',
        'confoundingEvaluation',
        'domain1a',
        'domain1b',
        'domain2',
        'domain3',
        'domain4',
        'domain5',
        'domain6',
        'overall',
      ];
      robinsKeys.forEach(key => {
        if (checklistTemplate[key] !== undefined) {
          answersData[key] = checklistTemplate[key];
        }
      });
    }

    const checklistYMap = new Y.Map();
    checklistYMap.set('type', type);
    checklistYMap.set('title', `${type} Checklist`);
    checklistYMap.set('assignedTo', assignedTo);
    checklistYMap.set('status', 'pending');
    checklistYMap.set('isReconciled', false);
    checklistYMap.set('createdAt', now);
    checklistYMap.set('updatedAt', now);

    // Store answers as a Y.Map
    const answersYMap = new Y.Map();

    if (type === CHECKLIST_TYPES.AMSTAR2) {
      // AMSTAR2: Store each question as a nested Y.Map with answers and critical
      Object.entries(answersData).forEach(([questionKey, questionData]) => {
        const questionYMap = new Y.Map();
        questionYMap.set('answers', questionData.answers);
        questionYMap.set('critical', questionData.critical);
        answersYMap.set(questionKey, questionYMap);
      });
    } else {
      // Other types: Store data directly (will be serialized as JSON)
      Object.entries(answersData).forEach(([key, value]) => {
        answersYMap.set(key, value);
      });
    }

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
    if (updates.isReconciled !== undefined) checklistYMap.set('isReconciled', updates.isReconciled);
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
   * Update a single answer/section in a checklist
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   * @param {string} key - The answer key (e.g., 'q1' for AMSTAR2, 'domain1a' for ROBINS-I)
   * @param {Object} data - The answer data (structure depends on checklist type)
   */
  function updateChecklistAnswer(studyId, checklistId, key, data) {
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

    const checklistType = checklistYMap.get('type');

    // AMSTAR2: Store as nested Y.Map with answers and critical
    if (checklistType === 'AMSTAR2' && data.answers !== undefined) {
      const questionYMap = new Y.Map();
      questionYMap.set('answers', data.answers);
      questionYMap.set('critical', data.critical);
      answersMap.set(key, questionYMap);
    }
    // ROBINS-I and other types: Store data directly
    else {
      answersMap.set(key, data);
    }

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
