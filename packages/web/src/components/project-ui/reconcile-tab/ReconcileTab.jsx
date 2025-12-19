import { For, Show, createMemo } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { CgArrowsExchange } from 'solid-icons/cg';
import ReconcileStudyCard from './ReconcileStudyCard.jsx';
import projectStore from '@/stores/projectStore.js';
import projectActionsStore from '@/stores/projectActionsStore';
import { useProjectContext } from '../ProjectContext.jsx';
import { isStudyInReconciliation } from '@/utils/reconciliation.js';

/**
 * ReconcileTab - Shows studies in reconciliation workflow
 * Displays studies with at least 1 completed checklist (dual reviewer mode)
 * Uses projectActionsStore directly for mutations.
 */
export default function ReconcileTab() {
  const { projectId, getAssigneeName } = useProjectContext();
  const navigate = useNavigate();

  // Read from store directly
  const studies = () => projectStore.getStudies(projectId);

  // Filter studies that are in reconciliation workflow
  const studiesInReconciliation = createMemo(() => {
    return studies().filter(isStudyInReconciliation);
  });

  // Navigation helpers
  const openReconciliation = (studyId, checklist1Id, checklist2Id) => {
    navigate(`/projects/${projectId}/studies/${studyId}/reconcile/${checklist1Id}/${checklist2Id}`);
  };

  const handleViewPdf = (studyId, pdf) => {
    projectActionsStore.pdf.view(studyId, pdf);
  };

  return (
    <div class='space-y-6'>
      <Show
        when={studiesInReconciliation().length > 0}
        fallback={
          <div class='py-16 text-center'>
            <CgArrowsExchange class='mx-auto mb-4 h-12 w-12 text-gray-300' />
            <h3 class='mb-2 text-lg font-medium text-gray-900'>Reconciliation</h3>
            <p class='mx-auto max-w-md text-gray-500'>
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
                  openReconciliation(study.id, checklist1Id, checklist2Id)
                }
                onViewPdf={pdf => handleViewPdf(study.id, pdf)}
                getAssigneeName={getAssigneeName}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
