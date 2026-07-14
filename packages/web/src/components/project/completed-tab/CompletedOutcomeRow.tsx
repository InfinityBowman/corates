/**
 * CompletedOutcomeRow - Single outcome row within a completed study
 */

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getChecklistMetadata } from '@/checklist-registry';
import {
  getReopenableReconciledChecklist,
  getStatusLabel,
  getStatusStyle,
} from '@corates/shared/checklists';
import { PencilIcon } from 'lucide-react';
import { ChangeOutcomeDialog } from '../ChangeOutcomeDialog';
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
  const [showChangeOutcome, setShowChangeOutcome] = useState(false);

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
            <div className='flex items-center gap-1'>
              <Badge variant='secondary'>{outcomeName}</Badge>
              <Button
                variant='ghost'
                size='icon'
                className='size-6'
                title='Change outcome'
                aria-label='Change outcome'
                onClick={() => setShowChangeOutcome(true)}
              >
                <PencilIcon className='size-3.5' />
              </Button>
            </div>
          )}
          <Badge variant='secondary'>{getChecklistMetadata(outcomeGroup.type).name}</Badge>
          <Badge variant='secondary' className={getStatusStyle(finalizedChecklist?.status)}>
            {getStatusLabel(finalizedChecklist?.status)}
          </Badge>
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

      {outcomeGroup.outcomeId && (
        <ChangeOutcomeDialog
          study={study}
          checklistType={outcomeGroup.type}
          outcomeId={outcomeGroup.outcomeId}
          open={showChangeOutcome}
          onOpenChange={setShowChangeOutcome}
        />
      )}
    </>
  );
}
