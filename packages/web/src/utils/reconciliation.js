/**
 * Reconciliation utility functions
 * Shared logic for determining if a study is in the reconciliation workflow
 */

/**
 * Determines if a study is eligible for reconciliation
 * @param {Object} study - The study object
 * @returns {boolean} True if the study should be shown in reconciliation workflow
 */
export function isStudyInReconciliation(study) {
  // Must have both reviewers assigned
  if (!study.reviewer1 || !study.reviewer2) {
    return false;
  }

  const checklists = study.checklists || [];

  // Skip if already has a completed reconciled checklist
  if (checklists.some(c => c.isReconciled && c.status === 'completed')) {
    return false;
  }

  // Count completed checklists (excluding reconciled ones)
  const completedChecklists = checklists.filter(c => c.status === 'completed' && !c.isReconciled);

  // Check if there's an in-progress reconciliation
  const hasInProgressReconciliation = checklists.some(
    c => c.isReconciled && c.status !== 'completed',
  );

  // Show if:
  // 1. There's an in-progress reconciliation, OR
  // 2. There are 1 or 2 completed (non-reconciled) checklists
  return (
    hasInProgressReconciliation ||
    (completedChecklists.length >= 1 && completedChecklists.length <= 2)
  );
}
