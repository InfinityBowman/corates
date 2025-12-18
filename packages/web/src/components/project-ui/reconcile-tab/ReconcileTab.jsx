import { For, Show, createMemo } from 'solid-js';
import { CgArrowsExchange } from 'solid-icons/cg';
import ReconcileStudyCard from '../ReconcileStudyCard.jsx';
import projectStore from '@/stores/projectStore.js';
import { useProjectContext } from '../ProjectContext.jsx';

/**
 * ReconcileTab - Shows studies ready for reconciliation
 * Uses ProjectContext for projectId, handlers, and helpers
 */
export default function ReconcileTab() {
  const { projectId, handlers, getAssigneeName } = useProjectContext();
  const { checklistHandlers, pdfHandlers } = handlers;

  // Read from store directly
  const studies = () => projectStore.getStudies(projectId);

  // Filter studies that are ready to reconcile:
  // - Has exactly 2 completed checklists (standard workflow)
  const readyToReconcileStudies = createMemo(() => {
    return studies().filter(study => {
      const checklists = study.checklists || [];
      // Count completed checklists
      const completedChecklists = checklists.filter(c => c.status === 'completed');
      // Only show studies with exactly 2 completed checklists for automatic reconciliation
      return completedChecklists.length === 2;
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
                  checklistHandlers.openReconciliation(study.id, checklist1Id, checklist2Id)
                }
                onViewPdf={pdf => pdfHandlers.handleViewPdf(study.id, pdf)}
                getAssigneeName={getAssigneeName}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
