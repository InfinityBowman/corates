/**
 * CompletedOutcomeRow - Single outcome row within a completed study
 */

import { useState, useMemo } from 'react';
import { getChecklistMetadata } from '@/checklist-registry';
import { getStatusLabel, getStatusStyle } from '@corates/shared/checklists';
import { PreviousReviewersView } from './PreviousReviewersView';

interface CompletedOutcomeRowProps {
  study: any;
  outcomeGroup: { outcomeId: string | null; type: string; checklists: any[] };
  onOpenChecklist: (checklistId: string) => void;
  getAssigneeName: (userId: string) => string;
  getOutcomeName: (outcomeId: string) => string | null;
  getReconciliationProgress: (outcomeId: string | null, type: string) => any;
}

export function CompletedOutcomeRow({
  study,
  outcomeGroup,
  onOpenChecklist,
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
            {(getChecklistMetadata(outcomeGroup.type) as any)?.name || outcomeGroup.type}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusStyle(finalizedChecklist?.status)}`}
          >
            {getStatusLabel(finalizedChecklist?.status)}
          </span>
        </div>

        <div className='flex items-center gap-2'>
          {hasPreviousReviewers && (
            <button
              onClick={() => setShowPreviousReviewers(true)}
              className='bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors'
            >
              View Previous
            </button>
          )}
          <button
            onClick={() => onOpenChecklist(finalizedChecklist?.id)}
            className='bg-primary hover:bg-primary/90 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors'
          >
            Open
          </button>
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
