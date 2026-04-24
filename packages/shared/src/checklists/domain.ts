/**
 * Checklist Domain Logic
 *
 * Centralized business logic for filtering and querying checklists.
 * UI components should use these functions instead of implementing filtering logic inline.
 */

import { CHECKLIST_STATUS } from './status.js';
import type { Study, ChecklistMetadata } from './types.js';

export interface ChecklistGroup {
  outcomeId: string | null;
  type: string;
  checklists: ChecklistMetadata[];
}

/**
 * Checks if a checklist is a reconciled checklist
 * Reconciled checklists are identified by having no assignedTo (null) since they represent consensus
 * @param checklist - The checklist object
 * @returns True if the checklist is a reconciled checklist
 */
export function isReconciledChecklist(checklist: ChecklistMetadata | null | undefined): boolean {
  if (!checklist) return false;
  return checklist.assignedTo === null;
}

/**
 * Gets checklists for the todo tab (assigned to user, not finalized or reviewer-completed)
 * @param study - The study object
 * @param userId - The current user ID
 * @returns Array of checklists for todo tab
 */
export function getTodoChecklists(
  study: Study | null | undefined,
  userId: string | null | undefined,
): ChecklistMetadata[] {
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
 * @param study - The study object
 * @returns Array of checklists for completed tab
 */
export function getCompletedChecklists(study: Study | null | undefined): ChecklistMetadata[] {
  if (!study) return [];
  const checklists = study.checklists || [];
  return checklists.filter(c => c.status === CHECKLIST_STATUS.FINALIZED);
}

/**
 * Gets the finalized checklist for a study (the authoritative version for tables/charts)
 * @param study - The study object
 * @returns The finalized checklist or null if not found
 */
export function getFinalizedChecklist(study: Study | null | undefined): ChecklistMetadata | null {
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
 * @param study - The study object
 * @returns Array of checklists in reconciliation workflow
 */
export function getReconciliationChecklists(study: Study | null | undefined): ChecklistMetadata[] {
  if (!study) return [];
  const checklists = study.checklists || [];
  return checklists.filter(
    c => !isReconciledChecklist(c) && c.status === CHECKLIST_STATUS.REVIEWER_COMPLETED,
  );
}

/**
 * Determines if a study should appear in a specific tab
 * @param study - The study object
 * @param tab - The tab name ('todo', 'reconcile', 'completed')
 * @param userId - The current user ID (required for 'todo' tab)
 * @returns True if study should appear in the tab
 */
export function shouldShowInTab(
  study: Study | null | undefined,
  tab: 'todo' | 'reconcile' | 'completed',
  userId?: string | null,
): boolean {
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

      const awaitingReconcile = checklists.filter(
        c => !isReconciledChecklist(c) && c.status === CHECKLIST_STATUS.REVIEWER_COMPLETED,
      );

      if (awaitingReconcile.length === 0) return false;

      // Group by outcomeId (for ROB2/ROBINS_I) or by type (for AMSTAR2)
      const groups = new Map<
        string,
        { checklists: ChecklistMetadata[]; outcomeId: string | null; type: string }
      >();
      for (const checklist of awaitingReconcile) {
        const groupKey = checklist.outcomeId || `type:${checklist.type}`;
        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            checklists: [],
            outcomeId: checklist.outcomeId ?? null,
            type: checklist.type,
          });
        }
        groups.get(groupKey)!.checklists.push(checklist);
      }

      // Check if any group has a pair ready for reconciliation
      // AND doesn't already have a finalized reconciled checklist for that outcome
      for (const group of groups.values()) {
        if (group.checklists.length === 2) {
          const hasFinalized = checklists.some(
            c =>
              isReconciledChecklist(c) &&
              c.status === CHECKLIST_STATUS.FINALIZED &&
              c.type === group.type &&
              (c.outcomeId ?? null) === group.outcomeId,
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
 * @param studies - Array of study objects
 * @param tab - The tab name ('todo', 'reconcile', 'completed')
 * @param userId - The current user ID (required for 'todo' tab)
 * @returns Filtered array of studies
 */
export function getStudiesForTab(
  studies: Study[] | null | undefined,
  tab: 'todo' | 'reconcile' | 'completed',
  userId?: string | null,
): (Study & { _needsChecklist?: boolean })[] {
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
      .filter(study => (study.checklists?.length ?? 0) > 0 || study._needsChecklist);
  }

  // For other tabs, just filter studies
  return studies.filter(study => shouldShowInTab(study, tab, userId));
}

/**
 * Gets the count of studies/checklists for a tab badge
 * @param studies - Array of study objects
 * @param tab - The tab name ('todo', 'reconcile', 'completed')
 * @param userId - The current user ID (required for 'todo' tab)
 * @returns Count for the tab badge
 */
export function getChecklistCount(
  studies: Study[] | null | undefined,
  tab: 'todo' | 'reconcile' | 'completed',
  userId?: string | null,
): number {
  if (!studies || !Array.isArray(studies)) return 0;
  return getStudiesForTab(studies, tab, userId).length;
}

/**
 * Determines the next status when a reviewer marks their checklist as complete
 * @param study - The study object
 * @returns The status to set (FINALIZED for single reviewer, REVIEWER_COMPLETED for dual reviewer)
 */
export function getNextStatusForCompletion(study: Study | null | undefined): string {
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
 * @param study - The study object
 * @param excludeId - Optional checklist ID to exclude from search
 * @returns The reconciled checklist or null if not found
 */
export function findReconciledChecklist(
  study: Study | null | undefined,
  excludeId: string | null = null,
): ChecklistMetadata | null {
  if (!study || !study.checklists) return null;

  const reconciled = study.checklists.find(
    c => isReconciledChecklist(c) && (!excludeId || c.id !== excludeId),
  );

  return reconciled || null;
}

/**
 * Gets all reconciled checklists for a study that are not yet finalized
 * @param study - The study object
 * @returns Array of in-progress or reconciling checklists
 */
export function getInProgressReconciledChecklists(
  study: Study | null | undefined,
): ChecklistMetadata[] {
  if (!study || !study.checklists) return [];

  return study.checklists.filter(
    c => isReconciledChecklist(c) && c.status !== CHECKLIST_STATUS.FINALIZED,
  );
}

/**
 * Determines if a study has dual reviewers
 * @param study - The study object
 * @returns True if study has both reviewer1 and reviewer2
 */
export function isDualReviewerStudy(study: Study | null | undefined): boolean {
  if (!study) return false;
  return !!(study.reviewer1 && study.reviewer2);
}

/**
 * Gets the original reviewer checklists that were reconciled
 * @param study - The study object
 * @param reconciliationProgress - Reconciliation progress data with checklist1Id and checklist2Id
 * @returns Array of original reviewer checklists (metadata only)
 */
export function getOriginalReviewerChecklists(
  study: Study | null | undefined,
  reconciliationProgress: { checklist1Id?: string; checklist2Id?: string } | null | undefined,
): ChecklistMetadata[] {
  if (!study || !study.checklists || !reconciliationProgress) return [];

  const { checklist1Id, checklist2Id } = reconciliationProgress;
  if (!checklist1Id || !checklist2Id) return [];

  const checklists = study.checklists || [];
  const checklist1 = checklists.find(c => c.id === checklist1Id);
  const checklist2 = checklists.find(c => c.id === checklist2Id);

  const result: ChecklistMetadata[] = [];
  if (checklist1) result.push(checklist1);
  if (checklist2) result.push(checklist2);

  return result;
}

/**
 * Groups reconciliation-eligible checklists by outcome (or by type for AMSTAR2)
 */
export function getReconciliationChecklistsByOutcome(
  study: Study | null | undefined,
): ChecklistGroup[] {
  if (!study) return [];

  const checklists = study.checklists || [];

  const awaitingReconcile = checklists.filter(
    c => !isReconciledChecklist(c) && c.status === CHECKLIST_STATUS.REVIEWER_COMPLETED,
  );

  const groups = new Map<string, ChecklistGroup>();

  for (const checklist of awaitingReconcile) {
    const groupKey = checklist.outcomeId || `type:${checklist.type}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        outcomeId: checklist.outcomeId || null,
        type: checklist.type,
        checklists: [],
      });
    }

    groups.get(groupKey)!.checklists.push(checklist);
  }

  return Array.from(groups.values());
}

/**
 * Gets reconciliation pairs that are ready (have exactly 2 checklists)
 */
export function getReadyReconciliationPairs(study: Study | null | undefined): ChecklistGroup[] {
  const groups = getReconciliationChecklistsByOutcome(study);
  return groups.filter(g => g.checklists.length === 2);
}

/**
 * Finds a reconciled checklist for a specific outcome
 */
export function findReconciledChecklistForOutcome(
  study: Study | null | undefined,
  outcomeId: string | null,
  type: string,
  excludeId: string | null = null,
): ChecklistMetadata | null {
  if (!study || !study.checklists) return null;

  return (
    study.checklists.find(c => {
      if (!isReconciledChecklist(c)) return false;
      if (excludeId && c.id === excludeId) return false;
      if (c.type !== type) return false;
      return c.outcomeId === outcomeId;
    }) || null
  );
}

/**
 * Derives a consistent key for outcome-based grouping
 */
export function getOutcomeKey(outcomeId: string | null | undefined, type: string): string {
  return outcomeId || `type:${type}`;
}

/**
 * Groups completed checklists by outcome
 */
export function getCompletedChecklistsByOutcome(study: Study | null | undefined): ChecklistGroup[] {
  if (!study) return [];

  const checklists = study.checklists || [];
  const completed = checklists.filter(c => c.status === CHECKLIST_STATUS.FINALIZED);

  if (completed.length === 0) return [];

  const groups = new Map<string, ChecklistGroup>();

  for (const checklist of completed) {
    const groupKey = getOutcomeKey(checklist.outcomeId, checklist.type);

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        outcomeId: checklist.outcomeId || null,
        type: checklist.type,
        checklists: [],
      });
    }

    groups.get(groupKey)!.checklists.push(checklist);
  }

  return Array.from(groups.values());
}
