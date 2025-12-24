/**
 * Reconciliation utility functions
 * Shared logic for determining if a study is in the reconciliation workflow
 */

import { CHECKLIST_STATUS } from '@/constants/checklist-status.js';
import { isReconciledChecklist } from '@/lib/checklist-domain.js';

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

  // Check for individual reviewer checklists awaiting reconciliation
  // (not reconciled checklists - those are identified by assignedTo === null)
  const awaitingReconcile = checklists.filter(
    c => !isReconciledChecklist(c) && c.status === CHECKLIST_STATUS.AWAITING_RECONCILE,
  );

  // Show if there are 1 or 2 individual checklists awaiting reconciliation
  return awaitingReconcile.length >= 1 && awaitingReconcile.length <= 2;
}
