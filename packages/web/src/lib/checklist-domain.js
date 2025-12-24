/**
 * Checklist Domain Logic
 *
 * Centralized business logic for filtering and querying checklists.
 * UI components should use these functions instead of implementing filtering logic inline.
 */

import { CHECKLIST_STATUS } from '@/constants/checklist-status.js';

/**
 * Checks if a checklist is a reconciled checklist
 * Reconciled checklists are identified by having no assignedTo (null) since they represent consensus
 * @param {Object} checklist - The checklist object
 * @returns {boolean} True if the checklist is a reconciled checklist
 */
export function isReconciledChecklist(checklist) {
  if (!checklist) return false;
  // Reconciled checklists are created with assignedTo: null
  return checklist.assignedTo === null;
}

/**
 * Gets checklists for the todo tab (assigned to user, not completed/awaiting-reconcile)
 * @param {Object} study - The study object
 * @param {string} userId - The current user ID
 * @returns {Array} Array of checklists for todo tab
 */
export function getTodoChecklists(study, userId) {
  if (!study || !userId) return [];
  const checklists = study.checklists || [];
  return checklists.filter(
    c =>
      c.assignedTo === userId &&
      c.status !== CHECKLIST_STATUS.COMPLETED &&
      c.status !== CHECKLIST_STATUS.AWAITING_RECONCILE,
  );
}

/**
 * Gets checklists for the completed tab
 * @param {Object} study - The study object
 * @returns {Array} Array of checklists for completed tab
 */
export function getCompletedChecklists(study) {
  if (!study) return [];
  const checklists = study.checklists || [];
  return checklists.filter(c => c.status === CHECKLIST_STATUS.COMPLETED);
}

/**
 * Gets checklists in the reconciliation workflow
 * @param {Object} study - The study object
 * @returns {Array} Array of checklists in reconciliation workflow
 */
export function getReconciliationChecklists(study) {
  if (!study) return [];
  const checklists = study.checklists || [];
  // Return checklists that are awaiting reconciliation
  return checklists.filter(c => c.status === CHECKLIST_STATUS.AWAITING_RECONCILE);
}

/**
 * Determines if a study should appear in a specific tab
 * @param {Object} study - The study object
 * @param {string} tab - The tab name ('todo', 'reconcile', 'completed')
 * @param {string} userId - The current user ID (required for 'todo' tab)
 * @returns {boolean} True if study should appear in the tab
 */
export function shouldShowInTab(study, tab, userId) {
  if (!study) return false;

  switch (tab) {
    case 'todo': {
      if (!userId) return false;
      // Must be assigned to user
      if (study.reviewer1 !== userId && study.reviewer2 !== userId) return false;
      const checklists = study.checklists || [];
      const userChecklists = checklists.filter(c => c.assignedTo === userId);
      // Show if user has no checklist yet OR has a non-completed/awaiting-reconcile checklist
      return (
        userChecklists.length === 0 ||
        userChecklists.some(
          c =>
            c.status !== CHECKLIST_STATUS.COMPLETED &&
            c.status !== CHECKLIST_STATUS.AWAITING_RECONCILE,
        )
      );
    }

    case 'reconcile': {
      // Must have both reviewers assigned (single reviewer studies never go to reconcile tab)
      if (!study.reviewer1 || !study.reviewer2) return false;

      const checklists = study.checklists || [];

      // Check for individual reviewer checklists awaiting reconciliation
      // (not reconciled checklists - those are identified by assignedTo === null)
      const awaitingReconcile = checklists.filter(
        c => !isReconciledChecklist(c) && c.status === CHECKLIST_STATUS.AWAITING_RECONCILE,
      );

      // Show if there are 1 or 2 individual checklists awaiting reconciliation
      return awaitingReconcile.length >= 1 && awaitingReconcile.length <= 2;
    }

    case 'completed': {
      const checklists = study.checklists || [];
      return checklists.some(c => c.status === CHECKLIST_STATUS.COMPLETED);
    }

    default:
      return false;
  }
}

/**
 * Gets filtered studies for a specific tab
 * @param {Array} studies - Array of study objects
 * @param {string} tab - The tab name ('todo', 'reconcile', 'completed')
 * @param {string} userId - The current user ID (required for 'todo' tab)
 * @returns {Array} Filtered array of studies
 */
export function getStudiesForTab(studies, tab, userId) {
  if (!studies || !Array.isArray(studies)) return [];

  if (tab === 'todo') {
    // For todo tab, also transform studies to include filtered checklists
    return studies
      .filter(study => shouldShowInTab(study, tab, userId))
      .map(study => {
        const originalChecklists = study.checklists || [];
        const todoChecklists = getTodoChecklists(study, userId);
        const userHasChecklist = originalChecklists.some(c => c.assignedTo === userId);
        return {
          ...study,
          checklists: todoChecklists,
          _needsChecklist: !userHasChecklist,
        };
      })
      .filter(study => study.checklists.length > 0 || study._needsChecklist);
  }

  // For other tabs, just filter studies
  return studies.filter(study => shouldShowInTab(study, tab, userId));
}

/**
 * Gets the count of studies/checklists for a tab badge
 * @param {Array} studies - Array of study objects
 * @param {string} tab - The tab name ('todo', 'reconcile', 'completed')
 * @param {string} userId - The current user ID (required for 'todo' tab)
 * @returns {number} Count for the tab badge
 */
export function getChecklistCount(studies, tab, userId) {
  if (!studies || !Array.isArray(studies)) return 0;
  return getStudiesForTab(studies, tab, userId).length;
}

/**
 * Determines the next status when a reviewer marks their checklist as complete
 * @param {Object} study - The study object
 * @returns {string} The status to set (COMPLETED or AWAITING_RECONCILE)
 */
export function getNextStatusForCompletion(study) {
  if (!study) return CHECKLIST_STATUS.COMPLETED;

  const isSingleReviewer = study.reviewer1 && !study.reviewer2;
  if (isSingleReviewer) {
    // Single reviewer: goes directly to completed
    return CHECKLIST_STATUS.COMPLETED;
  }

  // Dual reviewer: goes to awaiting-reconcile
  return CHECKLIST_STATUS.AWAITING_RECONCILE;
}

/**
 * Finds the reconciled checklist for a study, if one exists
 * @param {Object} study - The study object
 * @param {string} excludeId - Optional checklist ID to exclude from search
 * @returns {Object|null} The reconciled checklist or null if not found
 */
export function findReconciledChecklist(study, excludeId = null) {
  if (!study || !study.checklists) return null;

  const reconciled = study.checklists.find(
    c => isReconciledChecklist(c) && (!excludeId || c.id !== excludeId),
  );

  return reconciled || null;
}

/**
 * Gets all reconciled checklists for a study that are not yet completed
 * @param {Object} study - The study object
 * @returns {Array} Array of in-progress reconciled checklists
 */
export function getInProgressReconciledChecklists(study) {
  if (!study || !study.checklists) return [];

  return study.checklists.filter(
    c => isReconciledChecklist(c) && c.status !== CHECKLIST_STATUS.COMPLETED,
  );
}
