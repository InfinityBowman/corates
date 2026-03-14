/**
 * Checklist operations for projectActionsStore
 */

import { showToast } from '@/components/ui/toast';

/**
 * Creates checklist operations
 * @param {Function} getActiveConnection - Function to get current Y.js connection
 * @returns {Object} Checklist operations
 */
export function createChecklistActions(getActiveConnection) {
  /**
   * Create a new checklist (uses active project)
   * @param {string} studyId - The study ID
   * @param {string} type - Checklist type (AMSTAR2, ROB2, ROBINS_I)
   * @param {string} assigneeId - User ID to assign the checklist to
   * @param {string|null} outcomeId - Outcome ID (required for ROB2/ROBINS_I)
   * @returns {boolean} Success
   */
  function create(studyId, type, assigneeId, outcomeId = null) {
    const ops = getActiveConnection();
    if (!ops?.createChecklist) {
      showToast.error('Addition Failed', 'Not connected to project');
      return false;
    }
    try {
      const checklistId = ops.createChecklist(studyId, type, assigneeId, outcomeId);
      if (!checklistId) {
        // Could be duplicate or missing outcome
        const requiresOutcome = type === 'ROB2' || type === 'ROBINS_I';
        if (requiresOutcome && !outcomeId) {
          showToast.error('Addition Failed', `${type} requires an outcome to be selected`);
        } else if (requiresOutcome) {
          showToast.error(
            'Addition Failed',
            'You already have a checklist for this outcome. Select a different outcome.',
          );
        } else {
          showToast.error('Addition Failed', 'Failed to add checklist');
        }
        return false;
      }
      return true;
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
    try {
      const ops = getActiveConnection();
      return ops?.getChecklistData?.(studyId, checklistId);
    } catch (err) {
      // Handle case where there's no active project (e.g., during navigation)
      if (err.message?.includes('No active project')) {
        return null;
      }
      throw err;
    }
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
