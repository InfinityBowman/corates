/**
 * ReconcileStatusTag - Shows "Waiting for {Reviewer}" or "Ready" status
 */

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { CHECKLIST_STATUS, isReconciledChecklist } from '@corates/shared/checklists';
import type { StudyInfo } from '@/stores/projectStore';

interface ReconcileStatusTagProps {
  study: StudyInfo;
  getAssigneeName: (userId: string) => string;
}

export function ReconcileStatusTag({ study, getAssigneeName }: ReconcileStatusTagProps) {
  const awaitingChecklists = useMemo(
    () =>
      study.checklists.filter(
        c => !isReconciledChecklist(c) && c.status === CHECKLIST_STATUS.REVIEWER_COMPLETED,
      ),
    [study.checklists],
  );

  const isReady = awaitingChecklists.length === 2;

  const waitingForName = useMemo(() => {
    if (isReady || awaitingChecklists.length !== 1) return null;
    const awaitingReviewerId = awaitingChecklists[0].assignedTo;
    const waitingReviewerId =
      awaitingReviewerId === study.reviewer1 ? study.reviewer2 : study.reviewer1;
    if (!waitingReviewerId) return null;
    return getAssigneeName(waitingReviewerId);
  }, [isReady, awaitingChecklists, study.reviewer1, study.reviewer2, getAssigneeName]);

  if (isReady) {
    return <Badge variant='success'>Ready</Badge>;
  }

  return <Badge variant='warning'>Waiting for {waitingForName}</Badge>;
}
