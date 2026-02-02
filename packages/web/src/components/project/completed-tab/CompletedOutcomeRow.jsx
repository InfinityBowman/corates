/**
 * CompletedOutcomeRow - Single outcome row within completed study
 *
 * Displays a completed checklist for a specific outcome with actions to open
 * the checklist and view previous reviewer checklists (for dual-reviewer studies).
 */

import { createSignal, Show } from 'solid-js';
import { getChecklistMetadata } from '@/checklist-registry';
import { getStatusLabel, getStatusStyle } from '@/constants/checklist-status.js';
import PreviousReviewersView from './PreviousReviewersView.jsx';

export default function CompletedOutcomeRow(props) {
  // props.study: Study object
  // props.outcomeGroup: { outcomeId: string|null, type: string, checklists: Array }
  // props.onOpenChecklist: (checklistId) => void
  // props.getAssigneeName: (userId) => string
  // props.getOutcomeName: (outcomeId) => string | null
  // props.getReconciliationProgress: (outcomeId, type) => Object | null

  const [showPreviousReviewers, setShowPreviousReviewers] = createSignal(false);

  const outcomeGroup = () => props.outcomeGroup;

  // Get the first finalized checklist (the reconciled one)
  const finalizedChecklist = () => outcomeGroup().checklists[0];

  // Get outcome name for display
  const outcomeName = () => {
    const outcomeId = outcomeGroup().outcomeId;
    if (!outcomeId) return null;
    return props.getOutcomeName?.(outcomeId) || 'Unknown Outcome';
  };

  // Get reconciliation progress for this outcome
  const reconciliationProgress = () => {
    return props.getReconciliationProgress?.(outcomeGroup().outcomeId, outcomeGroup().type);
  };

  // Check if we have previous reviewers to show
  const hasPreviousReviewers = () => {
    const progress = reconciliationProgress();
    return !!(progress?.checklist1Id && progress?.checklist2Id);
  };

  return (
    <>
      <div class='bg-muted/50 flex items-center justify-between rounded-lg p-3'>
        <div class='flex items-center gap-3'>
          {/* Outcome badge */}
          <Show when={outcomeName()}>
            <span class='bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium'>
              {outcomeName()}
            </span>
          </Show>

          {/* Checklist type */}
          <span class='text-foreground text-sm font-medium'>
            {getChecklistMetadata(outcomeGroup().type)?.name || outcomeGroup().type}
          </span>

          {/* Status badge */}
          <span
            class={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusStyle(finalizedChecklist()?.status)}`}
          >
            {getStatusLabel(finalizedChecklist()?.status)}
          </span>
        </div>

        <div class='flex items-center gap-2'>
          {/* View Previous button (for dual-reviewer studies) */}
          <Show when={hasPreviousReviewers()}>
            <button
              onClick={() => setShowPreviousReviewers(true)}
              class='bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors'
            >
              View Previous
            </button>
          </Show>

          {/* Open button */}
          <button
            onClick={() => props.onOpenChecklist?.(finalizedChecklist()?.id)}
            class='bg-primary hover:bg-primary/90 focus:ring-primary rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none'
          >
            Open
          </button>
        </div>
      </div>

      {/* Previous Reviewers View Dialog */}
      <Show when={showPreviousReviewers()}>
        <PreviousReviewersView
          study={props.study}
          reconciliationProgress={reconciliationProgress()}
          getAssigneeName={props.getAssigneeName}
          onClose={() => setShowPreviousReviewers(false)}
        />
      </Show>
    </>
  );
}
