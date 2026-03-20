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

export function isEditable(status: string): boolean {
  return (
    status !== CHECKLIST_STATUS.FINALIZED &&
    status !== CHECKLIST_STATUS.REVIEWER_COMPLETED &&
    status !== CHECKLIST_STATUS.RECONCILING
  );
}

export function getStatusLabel(status: string): string {
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

export function getStatusStyle(status: string): string {
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

export function canTransitionTo(currentStatus: string, newStatus: string): boolean {
  if (currentStatus === newStatus) return true;

  if (currentStatus === CHECKLIST_STATUS.PENDING && newStatus === CHECKLIST_STATUS.IN_PROGRESS) {
    return true;
  }

  if (currentStatus === CHECKLIST_STATUS.IN_PROGRESS) {
    return (
      newStatus === CHECKLIST_STATUS.REVIEWER_COMPLETED || newStatus === CHECKLIST_STATUS.FINALIZED
    );
  }

  if (currentStatus === CHECKLIST_STATUS.RECONCILING && newStatus === CHECKLIST_STATUS.FINALIZED) {
    return true;
  }

  if (
    currentStatus === CHECKLIST_STATUS.FINALIZED ||
    currentStatus === CHECKLIST_STATUS.REVIEWER_COMPLETED
  ) {
    return false;
  }

  return false;
}
