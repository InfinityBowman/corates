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
 * Gets checklists for the todo tab (assigned to user, not finalized or reviewer-completed)
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
      c.status !== CHECKLIST_STATUS.FINALIZED &&
      c.status !== CHECKLIST_STATUS.REVIEWER_COMPLETED,
  );
}

/**
 * Gets checklists for the completed tab (finalized checklists)
 * @param {Object} study - The study object
 * @returns {Array} Array of checklists for completed tab
 */
export function getCompletedChecklists(study) {
  if (!study) return [];
  const checklists = study.checklists || [];
  return checklists.filter(c => c.status === CHECKLIST_STATUS.FINALIZED);
}

/**
 * Gets the finalized checklist for a study (the authoritative version for tables/charts)
 * @param {Object} study - The study object
 * @returns {Object|null} The finalized checklist or null if not found
 */
export function getFinalizedChecklist(study) {
  if (!study || !study.checklists) return null;
  const checklists = study.checklists || [];
  // Prefer reconciled checklist if it's finalized
  const reconciled = checklists.find(
    c => isReconciledChecklist(c) && c.status === CHECKLIST_STATUS.FINALIZED,
  );
  if (reconciled) return reconciled;
  // Otherwise, find any finalized checklist
  return checklists.find(c => c.status === CHECKLIST_STATUS.FINALIZED) || null;
}

/**
 * Gets checklists in the reconciliation workflow (individual reviewer checklists that are completed)
 * @param {Object} study - The study object
 * @returns {Array} Array of checklists in reconciliation workflow
 */
export function getReconciliationChecklists(study) {
  if (!study) return [];
  const checklists = study.checklists || [];
  // Return individual reviewer checklists that are completed (awaiting reconciliation)
  return checklists.filter(
    c => !isReconciledChecklist(c) && c.status === CHECKLIST_STATUS.REVIEWER_COMPLETED,
  );
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
      // Show if user has no checklist yet OR has a non-finalized/reviewer-completed checklist
      return (
        userChecklists.length === 0 ||
        userChecklists.some(
          c =>
            c.status !== CHECKLIST_STATUS.FINALIZED &&
            c.status !== CHECKLIST_STATUS.REVIEWER_COMPLETED,
        )
      );
    }

    case 'reconcile': {
      // Must have both reviewers assigned (single reviewer studies never go to reconcile tab)
      if (!study.reviewer1 || !study.reviewer2) return false;

      const checklists = study.checklists || [];

      // Get reviewer-completed checklists grouped by outcome
      const awaitingReconcile = checklists.filter(
        c => !isReconciledChecklist(c) && c.status === CHECKLIST_STATUS.REVIEWER_COMPLETED,
      );

      if (awaitingReconcile.length === 0) return false;

      // Group by outcomeId (or type for AMSTAR2)
      const groups = new Map();
      for (const checklist of awaitingReconcile) {
        const groupKey = checklist.outcomeId || `type:${checklist.type}`;
        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            checklists: [],
            outcomeId: checklist.outcomeId,
            type: checklist.type,
          });
        }
        groups.get(groupKey).checklists.push(checklist);
      }

      // Check if any group has a pair ready for reconciliation (exactly 2 checklists)
      // AND doesn't already have a finalized reconciled checklist for that outcome
      for (const group of groups.values()) {
        if (group.checklists.length === 2) {
          // Check if there's already a finalized reconciled checklist for this outcome
          const hasFinalized = checklists.some(
            c =>
              isReconciledChecklist(c) &&
              c.status === CHECKLIST_STATUS.FINALIZED &&
              c.type === group.type &&
              c.outcomeId === group.outcomeId,
          );
          if (!hasFinalized) return true;
        }
      }

      // Also show if any group has 1 checklist waiting (waiting for second reviewer)
      for (const group of groups.values()) {
        if (group.checklists.length === 1) {
          return true;
        }
      }

      return false;
    }

    case 'completed': {
      const checklists = study.checklists || [];
      return checklists.some(c => c.status === CHECKLIST_STATUS.FINALIZED);
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
 * @returns {string} The status to set (FINALIZED for single reviewer, REVIEWER_COMPLETED for dual reviewer)
 */
export function getNextStatusForCompletion(study) {
  if (!study) return CHECKLIST_STATUS.FINALIZED;

  const isSingleReviewer = study.reviewer1 && !study.reviewer2;
  if (isSingleReviewer) {
    // Single reviewer: goes directly to finalized
    return CHECKLIST_STATUS.FINALIZED;
  }

  // Dual reviewer: goes to reviewer-completed (awaiting reconciliation)
  return CHECKLIST_STATUS.REVIEWER_COMPLETED;
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
 * Gets all reconciled checklists for a study that are not yet finalized
 * @param {Object} study - The study object
 * @returns {Array} Array of in-progress or reconciling checklists
 */
export function getInProgressReconciledChecklists(study) {
  if (!study || !study.checklists) return [];

  return study.checklists.filter(
    c => isReconciledChecklist(c) && c.status !== CHECKLIST_STATUS.FINALIZED,
  );
}

/**
 * Determines if a study has dual reviewers
 * @param {Object} study - The study object
 * @returns {boolean} True if study has both reviewer1 and reviewer2
 */
export function isDualReviewerStudy(study) {
  if (!study) return false;
  return !!(study.reviewer1 && study.reviewer2);
}

/**
 * Gets the original reviewer checklists that were reconciled
 * @param {Object} study - The study object
 * @param {Object} reconciliationProgress - Reconciliation progress data with checklist1Id and checklist2Id
 * @returns {Array} Array of original reviewer checklists (metadata only)
 */
export function getOriginalReviewerChecklists(study, reconciliationProgress) {
  if (!study || !study.checklists || !reconciliationProgress) return [];

  const { checklist1Id, checklist2Id } = reconciliationProgress;
  if (!checklist1Id || !checklist2Id) return [];

  const checklists = study.checklists || [];
  const checklist1 = checklists.find(c => c.id === checklist1Id);
  const checklist2 = checklists.find(c => c.id === checklist2Id);

  const result = [];
  if (checklist1) result.push(checklist1);
  if (checklist2) result.push(checklist2);

  return result;
}

/**
 * Groups reconciliation-eligible checklists by outcome (or by type for AMSTAR2)
 * @param {Object} study - The study object
 * @returns {Array<{outcomeId: string|null, type: string, checklists: Array}>} Groups of checklists
 */
export function getReconciliationChecklistsByOutcome(study) {
  if (!study) return [];

  const checklists = study.checklists || [];

  // Get all reviewer-completed checklists (not reconciled)
  const awaitingReconcile = checklists.filter(
    c => !isReconciledChecklist(c) && c.status === CHECKLIST_STATUS.REVIEWER_COMPLETED,
  );

  // Group by outcomeId (for ROB2/ROBINS_I) or by type (for AMSTAR2)
  const groups = new Map();

  for (const checklist of awaitingReconcile) {
    // For checklists with outcomeId, group by outcomeId
    // For checklists without outcomeId (AMSTAR2), group by type
    const groupKey = checklist.outcomeId || `type:${checklist.type}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        outcomeId: checklist.outcomeId || null,
        type: checklist.type,
        checklists: [],
      });
    }

    groups.get(groupKey).checklists.push(checklist);
  }

  return Array.from(groups.values());
}

/**
 * Gets reconciliation pairs that are ready (have exactly 2 checklists)
 * @param {Object} study - The study object
 * @returns {Array<{outcomeId: string|null, type: string, checklists: [checklist1, checklist2]}>}
 */
export function getReadyReconciliationPairs(study) {
  const groups = getReconciliationChecklistsByOutcome(study);
  return groups.filter(g => g.checklists.length === 2);
}

/**
 * Finds a reconciled checklist for a specific outcome
 * @param {Object} study - The study object
 * @param {string|null} outcomeId - The outcome ID (null for AMSTAR2)
 * @param {string} type - The checklist type
 * @param {string} excludeId - Optional checklist ID to exclude
 * @returns {Object|null} The reconciled checklist or null
 */
export function findReconciledChecklistForOutcome(study, outcomeId, type, excludeId = null) {
  if (!study || !study.checklists) return null;

  return (
    study.checklists.find(c => {
      if (!isReconciledChecklist(c)) return false;
      if (excludeId && c.id === excludeId) return false;
      if (c.type !== type) return false;

      // For checklists with outcomeId, must match
      // For checklists without outcomeId, outcomeId param should also be null
      return c.outcomeId === outcomeId;
    }) || null
  );
}

/**
 * Derives a consistent key for outcome-based grouping
 * @param {string|null} outcomeId - The outcome ID
 * @param {string} type - The checklist type
 * @returns {string} The outcome key
 */
export function getOutcomeKey(outcomeId, type) {
  return outcomeId || `type:${type}`;
}

/**
 * Groups completed checklists by outcome
 * @param {Object} study - The study object
 * @returns {Array<{outcomeId: string|null, type: string, checklists: Array}>} Groups of completed checklists
 */
export function getCompletedChecklistsByOutcome(study) {
  if (!study) return [];

  const checklists = study.checklists || [];
  const completed = checklists.filter(c => c.status === CHECKLIST_STATUS.FINALIZED);

  if (completed.length === 0) return [];

  const groups = new Map();

  for (const checklist of completed) {
    const groupKey = getOutcomeKey(checklist.outcomeId, checklist.type);

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        outcomeId: checklist.outcomeId || null,
        type: checklist.type,
        checklists: [],
      });
    }

    groups.get(groupKey).checklists.push(checklist);
  }

  return Array.from(groups.values());
}
