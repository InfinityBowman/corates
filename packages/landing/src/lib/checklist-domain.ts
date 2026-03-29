/**
 * Checklist Domain Logic
 *
 * Centralized business logic for filtering and querying checklists.
 * UI components should use these functions instead of implementing filtering logic inline.
 */

import { CHECKLIST_STATUS, type ChecklistStatus } from '@/constants/checklist-status';

export interface Checklist {
  id: string;
  assignedTo?: string | null;
  status?: string;
  type: string;
  outcomeId?: string | null;
  [key: string]: unknown;
}

export interface Study {
  id: string;
  checklists?: Checklist[];
  reviewer1?: unknown;
  reviewer2?: unknown;
  [key: string]: unknown;
}

export interface ReconciliationProgress {
  checklist1Id: string | null;
  checklist2Id: string | null;
}

export interface ChecklistGroup {
  outcomeId: string | null;
  type: string;
  checklists: Checklist[];
}

/**
 * Checks if a checklist is a reconciled checklist
 * Reconciled checklists are identified by having no assignedTo (null) since they represent consensus
 */
export function isReconciledChecklist(checklist: Checklist | null | undefined): boolean {
  if (!checklist) return false;
  // Reconciled checklists are created with assignedTo: null
  return checklist.assignedTo === null;
}

/**
 * Gets checklists for the todo tab (assigned to user, not finalized or reviewer-completed)
 */
export function getTodoChecklists(
  study: Study | null | undefined,
  userId: string | null,
): Checklist[] {
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
 */
export function getCompletedChecklists(study: Study | null | undefined): Checklist[] {
  if (!study) return [];
  const checklists = study.checklists || [];
  return checklists.filter(c => c.status === CHECKLIST_STATUS.FINALIZED);
}

/**
 * Gets the finalized checklist for a study (the authoritative version for tables/charts)
 */
export function getFinalizedChecklist(study: Study | null | undefined): Checklist | null {
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
 */
export function getReconciliationChecklists(study: Study | null | undefined): Checklist[] {
  if (!study) return [];
  const checklists = study.checklists || [];
  // Return individual reviewer checklists that are completed (awaiting reconciliation)
  return checklists.filter(
    c => !isReconciledChecklist(c) && c.status === CHECKLIST_STATUS.REVIEWER_COMPLETED,
  );
}

/**
 * Determines if a study should appear in a specific tab
 */
export function shouldShowInTab(
  study: Study | null | undefined,
  tab: string,
  userId: string | null,
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

      // Get reviewer-completed checklists grouped by outcome
      const awaitingReconcile = checklists.filter(
        c => !isReconciledChecklist(c) && c.status === CHECKLIST_STATUS.REVIEWER_COMPLETED,
      );

      if (awaitingReconcile.length === 0) return false;

      // Group by outcomeId (or type for AMSTAR2)
      const groups = new Map<
        string,
        { checklists: Checklist[]; outcomeId: string | null; type: string }
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

interface TodoStudy extends Study {
  _needsChecklist: boolean;
}

/**
 * Gets filtered studies for a specific tab
 */
export function getStudiesForTab(
  studies: Study[] | null | undefined,
  tab: string,
  userId: string | null,
): Study[] {
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
        } as TodoStudy;
      })
      .filter(study => study.checklists!.length > 0 || (study as TodoStudy)._needsChecklist);
  }

  // For other tabs, just filter studies
  return studies.filter(study => shouldShowInTab(study, tab, userId));
}

/**
 * Gets the count of studies/checklists for a tab badge
 */
export function getChecklistCount(
  studies: Study[] | null | undefined,
  tab: string,
  userId: string | null,
): number {
  if (!studies || !Array.isArray(studies)) return 0;
  return getStudiesForTab(studies, tab, userId).length;
}

/**
 * Determines the next status when a reviewer marks their checklist as complete
 */
export function getNextStatusForCompletion(study: Study | null | undefined): ChecklistStatus {
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
 */
export function findReconciledChecklist(
  study: Study | null | undefined,
  excludeId: string | null = null,
): Checklist | null {
  if (!study || !study.checklists) return null;

  const reconciled = study.checklists.find(
    c => isReconciledChecklist(c) && (!excludeId || c.id !== excludeId),
  );

  return reconciled || null;
}

/**
 * Gets all reconciled checklists for a study that are not yet finalized
 */
export function getInProgressReconciledChecklists(study: Study | null | undefined): Checklist[] {
  if (!study || !study.checklists) return [];

  return study.checklists.filter(
    c => isReconciledChecklist(c) && c.status !== CHECKLIST_STATUS.FINALIZED,
  );
}

/**
 * Determines if a study has dual reviewers
 */
export function isDualReviewerStudy(study: Study | null | undefined): boolean {
  if (!study) return false;
  return !!(study.reviewer1 && study.reviewer2);
}

/**
 * Gets the original reviewer checklists that were reconciled
 */
export function getOriginalReviewerChecklists(
  study: Study | null | undefined,
  reconciliationProgress: ReconciliationProgress | null | undefined,
): Checklist[] {
  if (!study || !study.checklists || !reconciliationProgress) return [];

  const { checklist1Id, checklist2Id } = reconciliationProgress;
  if (!checklist1Id || !checklist2Id) return [];

  const checklists = study.checklists || [];
  const checklist1 = checklists.find(c => c.id === checklist1Id);
  const checklist2 = checklists.find(c => c.id === checklist2Id);

  const result: Checklist[] = [];
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

  // Get all reviewer-completed checklists (not reconciled)
  const awaitingReconcile = checklists.filter(
    c => !isReconciledChecklist(c) && c.status === CHECKLIST_STATUS.REVIEWER_COMPLETED,
  );

  // Group by outcomeId (for ROB2/ROBINS_I) or by type (for AMSTAR2)
  const groups = new Map<string, ChecklistGroup>();

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
): Checklist | null {
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
