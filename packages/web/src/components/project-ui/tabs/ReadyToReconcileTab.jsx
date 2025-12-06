import { For, Show, createMemo } from 'solid-js';
import { CgArrowsExchange } from 'solid-icons/cg';
import ReconcileStudyCard from '../ReconcileStudyCard.jsx';
import projectStore from '@primitives/projectStore.js';

/**
 * ReadyToReconcileTab - Shows studies ready for reconciliation
 *
 * Props:
 * - projectId: string - The project ID
 * - checklistHandlers: { openReconciliation }
 * - pdfHandlers: { handleViewPdf }
 * - getAssigneeName: (userId) => string
 */
export default function ReadyToReconcileTab(props) {
  // Read from store directly
  const studies = () => projectStore.getStudies(props.projectId);

  // Filter studies that are ready to reconcile:
  // - Has at least 2 checklists
  // - Both checklists are marked as completed
  const readyToReconcileStudies = createMemo(() => {
    return studies().filter(study => {
      const checklists = study.checklists || [];
      if (checklists.length < 2) return false;

      // Count completed checklists
      const completedChecklists = checklists.filter(c => c.status === 'completed');
      return completedChecklists.length >= 2;
    });
  });

  return (
    <div class='space-y-6'>
      <Show
        when={readyToReconcileStudies().length > 0}
        fallback={
          <div class='text-center py-16'>
            <CgArrowsExchange class='w-12 h-12 text-gray-300 mx-auto mb-4' />
            <h3 class='text-lg font-medium text-gray-900 mb-2'>Ready to Reconcile</h3>
            <p class='text-gray-500 max-w-md mx-auto'>
              Studies where both reviewers have completed their checklists will appear here, ready
              for reconciliation.
            </p>
          </div>
        }
      >
        <div class='space-y-4'>
          <For each={readyToReconcileStudies()}>
            {study => (
              <ReconcileStudyCard
                study={study}
                onReconcile={(checklist1Id, checklist2Id) =>
                  props.checklistHandlers.openReconciliation(study.id, checklist1Id, checklist2Id)
                }
                onViewPdf={pdf => props.pdfHandlers.handleViewPdf(study.id, pdf)}
                getAssigneeName={props.getAssigneeName}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
