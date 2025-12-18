import { For, Show, createMemo } from 'solid-js';
import { CgArrowsExchange } from 'solid-icons/cg';
import ReconcileStudyCard from '../ReconcileStudyCard.jsx';
import projectStore from '@/stores/projectStore.js';
import { useProjectContext } from '../ProjectContext.jsx';

/**
 * ReconcileTab - Shows studies in reconciliation workflow
 * Displays studies with at least 1 completed checklist (dual reviewer mode)
 * Uses ProjectContext for projectId, handlers, and helpers
 */
export default function ReconcileTab() {
  const { projectId, handlers, getAssigneeName } = useProjectContext();
  const { checklistHandlers, pdfHandlers } = handlers;

  // Read from store directly
  const studies = () => projectStore.getStudies(projectId);

  // Filter studies that are in reconciliation workflow:
  // - Dual reviewer studies (has both reviewer1 and reviewer2)
  // - Has at least 1 completed checklist
  // - Does not have a reconciled checklist yet
  const studiesInReconciliation = createMemo(() => {
    return studies().filter(study => {
      // Only for dual-reviewer studies
      if (!study.reviewer1 || !study.reviewer2) return false;

      const checklists = study.checklists || [];

      // Skip if already has a reconciled checklist
      if (checklists.some(c => c.isReconciled)) return false;

      // Count completed checklists
      const completedChecklists = checklists.filter(c => c.status === 'completed');

      // Show if 1 or 2 checklists are completed
      return completedChecklists.length >= 1 && completedChecklists.length <= 2;
    });
  });

  return (
    <div class='space-y-6'>
      <Show
        when={studiesInReconciliation().length > 0}
        fallback={
          <div class='text-center py-16'>
            <CgArrowsExchange class='w-12 h-12 text-gray-300 mx-auto mb-4' />
            <h3 class='text-lg font-medium text-gray-900 mb-2'>Reconciliation</h3>
            <p class='text-gray-500 max-w-md mx-auto'>
              Studies where reviewers have completed their checklists will appear here for
              reconciliation.
            </p>
          </div>
        }
      >
        <div class='space-y-4'>
          <For each={studiesInReconciliation()}>
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
