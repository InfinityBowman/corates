/**
 * Common checklist operations shared across all checklist types
 */

import * as Y from 'yjs';

/**
 * Create shared checklist operations that work with any checklist type
 * @param {Function} getYDoc - Function that returns the Y.Doc
 * @returns {Object} Common operations
 */
export function createCommonOperations(getYDoc) {
  /**
   * Update a checklist's metadata
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   * @param {Object} updates - Fields to update (title, assignedTo, status)
   */
  function updateChecklist(studyId, checklistId, updates) {
    const ydoc = getYDoc();
    if (!ydoc) return;

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
    if (!ydoc) return;

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
   * Get a checklist's Y.Map and type
   * @param {string} studyId - The study ID
   * @param {string} checklistId - The checklist ID
   * @returns {{checklistYMap: Y.Map, checklistType: string}|null} The checklist Y.Map and type or null
   */
  function getChecklistYMap(studyId, checklistId) {
    const ydoc = getYDoc();
    if (!ydoc) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return null;

    const checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) return null;

    const checklistYMap = checklistsMap.get(checklistId);
    if (!checklistYMap) return null;

    const checklistType = checklistYMap.get('type');
    return { checklistYMap, checklistType };
  }

  return {
    updateChecklist,
    deleteChecklist,
    getChecklistAnswersMap,
    getChecklistYMap,
  };
}
