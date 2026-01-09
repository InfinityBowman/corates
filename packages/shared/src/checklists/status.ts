/**
 * Checklist Status Constants and Helpers
 *
 * Centralized status management for checklists. All status values and related
 * logic should use these constants and helper functions.
 */

export const CHECKLIST_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  REVIEWER_COMPLETED: 'reviewer-completed',
  RECONCILING: 'reconciling',
  FINALIZED: 'finalized',
} as const;

export type ChecklistStatus = (typeof CHECKLIST_STATUS)[keyof typeof CHECKLIST_STATUS];

/**
 * Determines if a checklist can be edited based on its status
 * @param status - The checklist status
 * @returns True if the checklist can be edited
 */
export function isEditable(status: ChecklistStatus | string): boolean {
  return (
    status !== CHECKLIST_STATUS.FINALIZED &&
    status !== CHECKLIST_STATUS.REVIEWER_COMPLETED &&
    status !== CHECKLIST_STATUS.RECONCILING
  );
}

/**
 * Gets a human-readable label for a status
 * @param status - The checklist status
 * @returns Human-readable label
 */
export function getStatusLabel(status: ChecklistStatus | string | undefined): string {
  switch (status) {
    case CHECKLIST_STATUS.PENDING:
      return 'Pending';
    case CHECKLIST_STATUS.IN_PROGRESS:
      return 'In Progress';
    case CHECKLIST_STATUS.REVIEWER_COMPLETED:
      return 'Reviewer Completed';
    case CHECKLIST_STATUS.RECONCILING:
      return 'Reconciling';
    case CHECKLIST_STATUS.FINALIZED:
      return 'Finalized';
    default:
      return status || 'Pending';
  }
}

/**
 * Validates if a status transition is allowed
 * @param currentStatus - The current status
 * @param newStatus - The desired new status
 * @returns True if the transition is valid
 */
export function canTransitionTo(
  currentStatus: ChecklistStatus | string,
  newStatus: ChecklistStatus | string,
): boolean {
  // Can always stay in the same state
  if (currentStatus === newStatus) return true;

  // Can transition from pending to in-progress (automatic on first edit)
  if (currentStatus === CHECKLIST_STATUS.PENDING && newStatus === CHECKLIST_STATUS.IN_PROGRESS) {
    return true;
  }

  // Can transition from in-progress to reviewer-completed or finalized
  if (currentStatus === CHECKLIST_STATUS.IN_PROGRESS) {
    return (
      newStatus === CHECKLIST_STATUS.REVIEWER_COMPLETED || newStatus === CHECKLIST_STATUS.FINALIZED
    );
  }

  // Can transition from reconciling to finalized (after reconciliation is complete)
  if (currentStatus === CHECKLIST_STATUS.RECONCILING && newStatus === CHECKLIST_STATUS.FINALIZED) {
    return true;
  }

  // Cannot transition from finalized or reviewer-completed to anything else (locked)
  if (
    currentStatus === CHECKLIST_STATUS.FINALIZED ||
    currentStatus === CHECKLIST_STATUS.REVIEWER_COMPLETED
  ) {
    return false;
  }

  return false;
}

/**
 * Gets Tailwind CSS classes for status badge styling.
 * Note: This is UI-specific but kept here for convenience.
 * Consider moving to web package if shared package should be pure logic.
 * @param status - The checklist status
 * @returns Tailwind classes for badge
 */
export function getStatusStyle(status: ChecklistStatus | string | undefined): string {
  switch (status) {
    case CHECKLIST_STATUS.FINALIZED:
      return 'bg-green-100 text-green-800';
    case CHECKLIST_STATUS.IN_PROGRESS:
      return 'bg-yellow-100 text-yellow-800';
    case CHECKLIST_STATUS.REVIEWER_COMPLETED:
      return 'bg-blue-100 text-blue-800';
    case CHECKLIST_STATUS.RECONCILING:
      return 'bg-purple-100 text-purple-800';
    case CHECKLIST_STATUS.PENDING:
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
