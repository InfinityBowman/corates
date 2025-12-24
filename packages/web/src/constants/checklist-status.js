/**
 * Checklist Status Constants and Helpers
 *
 * Centralized status management for checklists. All status values and related
 * logic should use these constants and helper functions.
 */

export const CHECKLIST_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  AWAITING_RECONCILE: 'awaiting-reconcile',
};

/**
 * Determines if a checklist can be edited based on its status
 * @param {string} status - The checklist status
 * @returns {boolean} True if the checklist can be edited
 */
export function isEditable(status) {
  return status !== CHECKLIST_STATUS.COMPLETED && status !== CHECKLIST_STATUS.AWAITING_RECONCILE;
}

/**
 * Gets a human-readable label for a status
 * @param {string} status - The checklist status
 * @returns {string} Human-readable label
 */
export function getStatusLabel(status) {
  switch (status) {
    case CHECKLIST_STATUS.PENDING:
      return 'Pending';
    case CHECKLIST_STATUS.IN_PROGRESS:
      return 'In Progress';
    case CHECKLIST_STATUS.COMPLETED:
      return 'Completed';
    case CHECKLIST_STATUS.AWAITING_RECONCILE:
      return 'Awaiting Reconcile';
    default:
      return status || 'Pending';
  }
}

/**
 * Gets Tailwind CSS classes for status badge styling
 * @param {string} status - The checklist status
 * @returns {string} Tailwind classes for badge
 */
export function getStatusStyle(status) {
  switch (status) {
    case CHECKLIST_STATUS.COMPLETED:
      return 'bg-green-100 text-green-800';
    case CHECKLIST_STATUS.IN_PROGRESS:
      return 'bg-yellow-100 text-yellow-800';
    case CHECKLIST_STATUS.AWAITING_RECONCILE:
      return 'bg-blue-100 text-blue-800';
    case CHECKLIST_STATUS.PENDING:
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Validates if a status transition is allowed
 * @param {string} currentStatus - The current status
 * @param {string} newStatus - The desired new status
 * @returns {boolean} True if the transition is valid
 */
export function canTransitionTo(currentStatus, newStatus) {
  // Can always stay in the same state
  if (currentStatus === newStatus) return true;

  // Can transition from pending to in-progress (automatic on first edit)
  if (currentStatus === CHECKLIST_STATUS.PENDING && newStatus === CHECKLIST_STATUS.IN_PROGRESS) {
    return true;
  }

  // Can transition from in-progress to completed or awaiting-reconcile
  if (currentStatus === CHECKLIST_STATUS.IN_PROGRESS) {
    return (
      newStatus === CHECKLIST_STATUS.COMPLETED || newStatus === CHECKLIST_STATUS.AWAITING_RECONCILE
    );
  }

  // Can transition from awaiting-reconcile to completed (after reconciliation)
  if (currentStatus === CHECKLIST_STATUS.AWAITING_RECONCILE && newStatus === CHECKLIST_STATUS.COMPLETED) {
    return true;
  }

  // Cannot transition from completed to anything else (locked)
  if (currentStatus === CHECKLIST_STATUS.COMPLETED) {
    return false;
  }

  // Default: disallow unknown transitions
  return false;
}
