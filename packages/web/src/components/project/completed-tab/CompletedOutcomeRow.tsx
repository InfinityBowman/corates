/**
 * CompletedOutcomeRow - Single outcome row within a completed study
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { getChecklistMetadata } from '@/checklist-registry';
import {
  getReopenableReconciledChecklist,
  getStatusLabel,
  getStatusStyle,
} from '@corates/shared/checklists';
import { PreviousReviewersView } from './PreviousReviewersView';
import { ReopenReconciliationButton } from './ReopenReconciliationButton';
import type { StudyInfo } from '@/stores/projectStore';
import type { ChecklistGroup } from '@corates/shared/checklists';
import type { ReconciliationProgressEntry } from '@/primitives/useProject/reconciliation';

interface CompletedOutcomeRowProps {
  study: StudyInfo;
  outcomeGroup: ChecklistGroup;
  onOpenChecklist: (checklistId: string) => void;
  onReopenReconciliation: (checklistId: string) => void;
  getAssigneeName: (userId: string) => string;
  getOutcomeName: (outcomeId: string) => string | null;
  getReconciliationProgress: (
    outcomeId: string | null,
    type: string,
  ) => ReconciliationProgressEntry | null;
}

export function CompletedOutcomeRow({
  study,
  outcomeGroup,
  onOpenChecklist,
  onReopenReconciliation,
  getAssigneeName,
  getOutcomeName,
  getReconciliationProgress,
}: CompletedOutcomeRowProps) {
  const [showPreviousReviewers, setShowPreviousReviewers] = useState(false);

  const finalizedChecklist = outcomeGroup.checklists[0];
  const outcomeName =
    outcomeGroup.outcomeId ? getOutcomeName(outcomeGroup.outcomeId) || 'Unknown Outcome' : null;

  const reconciliationProgress = useMemo(
    () => getReconciliationProgress?.(outcomeGroup.outcomeId, outcomeGroup.type),
    [getReconciliationProgress, outcomeGroup.outcomeId, outcomeGroup.type],
  );

  const hasPreviousReviewers = !!(
    reconciliationProgress?.checklist1Id && reconciliationProgress?.checklist2Id
  );

  const reopenableChecklist = useMemo(
    () => getReopenableReconciledChecklist(study, outcomeGroup.outcomeId, outcomeGroup.type),
    [study, outcomeGroup.outcomeId, outcomeGroup.type],
  );

  return (
    <>
      <div className='bg-muted/50 flex items-center justify-between rounded-lg p-3'>
        <div className='flex items-center gap-3'>
          {outcomeName && (
            <span className='bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium'>
              {outcomeName}
            </span>
          )}
          <span className='bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium'>
            {getChecklistMetadata(outcomeGroup.type).name}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusStyle(finalizedChecklist?.status)}`}
          >
            {getStatusLabel(finalizedChecklist?.status)}
          </span>
        </div>

        <div className='flex items-center gap-2'>
          {hasPreviousReviewers && (
            <Button variant='secondary' onClick={() => setShowPreviousReviewers(true)}>
              View Previous
            </Button>
          )}
          {reopenableChecklist && (
            <ReopenReconciliationButton
              onReopen={() => onReopenReconciliation(reopenableChecklist.id)}
            />
          )}
          <Button onClick={() => onOpenChecklist(finalizedChecklist?.id)}>Open</Button>
        </div>
      </div>

      {showPreviousReviewers && (
        <PreviousReviewersView
          study={study}
          reconciliationProgress={reconciliationProgress}
          getAssigneeName={getAssigneeName}
          onClose={() => setShowPreviousReviewers(false)}
        />
      )}
    </>
  );
}
