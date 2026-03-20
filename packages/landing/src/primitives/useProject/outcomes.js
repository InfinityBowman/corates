/**
 * Outcome operations for useProject
 * Manages project-level outcomes stored in Yjs meta map
 */

import * as Y from 'yjs';

/**
 * Creates outcome operations for a project
 * @param {string} projectId - The project ID
 * @param {Function} getYDoc - Function that returns the Y.Doc
 * @param {Function} isSynced - Function that returns sync status
 * @returns {Object} Outcome operations
 */
export function createOutcomeOperations(projectId, getYDoc, _isSynced) {
  /**
   * Get all outcomes for the project
   * @returns {Array<{id: string, name: string, createdAt: number, createdBy: string}>}
   */
  function getOutcomes() {
    const ydoc = getYDoc();
    if (!ydoc) return [];

    const metaMap = ydoc.getMap('meta');
    const outcomesMap = metaMap.get('outcomes');

    if (!outcomesMap || typeof outcomesMap.entries !== 'function') {
      return [];
    }

    const outcomes = [];
    for (const [outcomeId, outcomeYMap] of outcomesMap.entries()) {
      const outcomeData = outcomeYMap.toJSON ? outcomeYMap.toJSON() : outcomeYMap;
      outcomes.push({
        id: outcomeId,
        ...outcomeData,
      });
    }

    return outcomes.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }

  /**
   * Get a single outcome by ID
   * @param {string} outcomeId - The outcome ID
   * @returns {{id: string, name: string, createdAt: number, createdBy: string}|null}
   */
  function getOutcome(outcomeId) {
    const ydoc = getYDoc();
    if (!ydoc || !outcomeId) return null;

    const metaMap = ydoc.getMap('meta');
    const outcomesMap = metaMap.get('outcomes');

    if (!outcomesMap) return null;

    const outcomeYMap = outcomesMap.get(outcomeId);
    if (!outcomeYMap) return null;

    const outcomeData = outcomeYMap.toJSON ? outcomeYMap.toJSON() : outcomeYMap;
    return {
      id: outcomeId,
      ...outcomeData,
    };
  }

  /**
   * Create a new outcome
   * @param {string} name - Outcome name
   * @param {string} createdBy - User ID of creator
   * @returns {string|null} The outcome ID or null if failed
   */
  function createOutcome(name, createdBy) {
    try {
      const ydoc = getYDoc();
      if (!ydoc) {
        console.error('[createOutcome] No YDoc available');
        return null;
      }

      if (!name || !name.trim()) {
        console.error('[createOutcome] Outcome name is required');
        return null;
      }

      const outcomeId = crypto.randomUUID();
      const now = Date.now();

      const metaMap = ydoc.getMap('meta');
      let outcomesMap = metaMap.get('outcomes');

      if (!outcomesMap) {
        outcomesMap = new Y.Map();
        metaMap.set('outcomes', outcomesMap);
      }

      const outcomeYMap = new Y.Map();
      outcomeYMap.set('name', name.trim());
      outcomeYMap.set('createdAt', now);
      outcomeYMap.set('createdBy', createdBy);

      outcomesMap.set(outcomeId, outcomeYMap);
      metaMap.set('updatedAt', now);

      return outcomeId;
    } catch (err) {
      console.error('[createOutcome] Error creating outcome:', err);
      return null;
    }
  }

  /**
   * Update an outcome's name
   * @param {string} outcomeId - The outcome ID
   * @param {string} name - New name
   * @returns {boolean} True if updated successfully
   */
  function updateOutcome(outcomeId, name) {
    try {
      const ydoc = getYDoc();
      if (!ydoc) return false;

      if (!name || !name.trim()) {
        console.error('[updateOutcome] Outcome name is required');
        return false;
      }

      const metaMap = ydoc.getMap('meta');
      const outcomesMap = metaMap.get('outcomes');

      if (!outcomesMap) return false;

      const outcomeYMap = outcomesMap.get(outcomeId);
      if (!outcomeYMap) return false;

      outcomeYMap.set('name', name.trim());
      metaMap.set('updatedAt', Date.now());

      return true;
    } catch (err) {
      console.error('[updateOutcome] Error updating outcome:', err);
      return false;
    }
  }

  /**
   * Delete an outcome
   * @param {string} outcomeId - The outcome ID
   * @returns {{success: boolean, error?: string}} Result with success status and optional error
   */
  function deleteOutcome(outcomeId) {
    try {
      const ydoc = getYDoc();
      if (!ydoc) return { success: false, error: 'No connection' };

      // Check if outcome is in use by any checklist
      const studiesMap = ydoc.getMap('reviews');
      for (const [, studyYMap] of studiesMap.entries()) {
        const checklistsMap = studyYMap.get('checklists');
        if (!checklistsMap) continue;

        for (const [, checklistYMap] of checklistsMap.entries()) {
          const checklistOutcomeId = checklistYMap.get('outcomeId');
          if (checklistOutcomeId === outcomeId) {
            return {
              success: false,
              error: 'Cannot delete outcome that is in use by checklists',
            };
          }
        }
      }

      const metaMap = ydoc.getMap('meta');
      const outcomesMap = metaMap.get('outcomes');

      if (!outcomesMap) return { success: false, error: 'No outcomes found' };

      if (!outcomesMap.has(outcomeId)) {
        return { success: false, error: 'Outcome not found' };
      }

      outcomesMap.delete(outcomeId);
      metaMap.set('updatedAt', Date.now());

      return { success: true };
    } catch (err) {
      console.error('[deleteOutcome] Error deleting outcome:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Check if an outcome is in use by any checklist
   * @param {string} outcomeId - The outcome ID
   * @returns {boolean} True if the outcome is in use
   */
  function isOutcomeInUse(outcomeId) {
    const ydoc = getYDoc();
    if (!ydoc) return false;

    const studiesMap = ydoc.getMap('reviews');
    for (const [, studyYMap] of studiesMap.entries()) {
      const checklistsMap = studyYMap.get('checklists');
      if (!checklistsMap) continue;

      for (const [, checklistYMap] of checklistsMap.entries()) {
        if (checklistYMap.get('outcomeId') === outcomeId) {
          return true;
        }
      }
    }

    return false;
  }

  return {
    getOutcomes,
    getOutcome,
    createOutcome,
    updateOutcome,
    deleteOutcome,
    isOutcomeInUse,
  };
}
