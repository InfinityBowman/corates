/**
 * ReconcileStatusTag - Shows "Waiting for {Reviewer}" or "Ready" status
 */

import { useMemo } from 'react';
import { CHECKLIST_STATUS } from '@/constants/checklist-status';
import { isReconciledChecklist } from '@/lib/checklist-domain.js';

/* eslint-disable no-unused-vars */
interface ReconcileStatusTagProps {
  study: any;
  getAssigneeName: (userId: string) => string;
}
/* eslint-enable no-unused-vars */

export function ReconcileStatusTag({ study, getAssigneeName }: ReconcileStatusTagProps) {
  const awaitingChecklists = useMemo(
    () =>
      (study.checklists || []).filter(
        (c: any) => !isReconciledChecklist(c) && c.status === CHECKLIST_STATUS.REVIEWER_COMPLETED,
      ),
    [study.checklists],
  );

  const isReady = awaitingChecklists.length === 2;

  const waitingForName = useMemo(() => {
    if (isReady || awaitingChecklists.length !== 1) return null;
    const awaitingReviewerId = awaitingChecklists[0].assignedTo;
    const waitingReviewerId =
      awaitingReviewerId === study.reviewer1 ? study.reviewer2 : study.reviewer1;
    return getAssigneeName(waitingReviewerId);
  }, [isReady, awaitingChecklists, study.reviewer1, study.reviewer2, getAssigneeName]);

  if (isReady) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
        Ready
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-800">
      Waiting for {waitingForName}
    </span>
  );
}
