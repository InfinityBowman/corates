/**
 * Checklist operations for projectActionsStore
 */

import { showToast } from '@corates/ui';

/**
 * Creates checklist operations
 * @param {Function} getActiveConnection - Function to get current Y.js connection
 * @returns {Object} Checklist operations
 */
export function createChecklistActions(getActiveConnection) {
  /**
   * Create a new checklist (uses active project)
   * @returns {boolean} Success
   */
  function create(studyId, type, assigneeId) {
    const ops = getActiveConnection();
    if (!ops?.createChecklist) {
      showToast.error('Addition Failed', 'Not connected to project');
      return false;
    }
    try {
      const checklistId = ops.createChecklist(studyId, type, assigneeId);
      return !!checklistId;
    } catch (err) {
      console.error('Error adding checklist:', err);
      showToast.error('Addition Failed', 'Failed to add checklist');
      return false;
    }
  }

  /**
   * Update checklist properties (uses active project)
   */
  function update(studyId, checklistId, updates) {
    const ops = getActiveConnection();
    if (!ops?.updateChecklist) {
      showToast.error('Update Failed', 'Not connected to project');
      return;
    }
    try {
      ops.updateChecklist(studyId, checklistId, updates);
    } catch (err) {
      console.error('Error updating checklist:', err);
      showToast.error('Update Failed', 'Failed to update checklist');
    }
  }

  /**
   * Delete a checklist (low-level, no confirmation) (uses active project)
   */
  function deleteChecklist(studyId, checklistId) {
    const ops = getActiveConnection();
    if (!ops?.deleteChecklist) {
      showToast.error('Delete Failed', 'Not connected to project');
      return;
    }
    try {
      ops.deleteChecklist(studyId, checklistId);
    } catch (err) {
      console.error('Error deleting checklist:', err);
      showToast.error('Delete Failed', 'Failed to delete checklist');
    }
  }

  /**
   * Get Y.Map for checklist answers (low-level Y.js access)
   */
  function getAnswersMap(studyId, checklistId) {
    const ops = getActiveConnection();
    return ops?.getChecklistAnswersMap?.(studyId, checklistId);
  }

  /**
   * Get checklist data
   */
  function getData(studyId, checklistId) {
    const ops = getActiveConnection();
    return ops?.getChecklistData?.(studyId, checklistId);
  }

  /**
   * Update a single checklist answer
   */
  function updateAnswer(studyId, checklistId, questionId, answer, note) {
    const ops = getActiveConnection();
    return ops?.updateChecklistAnswer?.(studyId, checklistId, questionId, answer, note);
  }

  /**
   * Get note for a question
   */
  function getQuestionNote(studyId, checklistId, questionId) {
    const ops = getActiveConnection();
    return ops?.getQuestionNote?.(studyId, checklistId, questionId);
  }

  return {
    create,
    update,
    delete: deleteChecklist,
    getAnswersMap,
    getData,
    updateAnswer,
    getQuestionNote,
  };
}
