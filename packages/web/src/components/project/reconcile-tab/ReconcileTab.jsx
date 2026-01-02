import { For, Show, createMemo } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { CgArrowsExchange } from 'solid-icons/cg';
import ReconcileStudyRow from './ReconcileStudyRow.jsx';
import projectStore from '@/stores/projectStore.js';
import projectActionsStore from '@/stores/projectActionsStore';
import { useProjectContext } from '../ProjectContext.jsx';
import { getStudiesForTab } from '@/lib/checklist-domain.js';

/**
 * ReconcileTab - Shows studies in reconciliation workflow
 * Displays studies with at least 1 completed checklist (dual reviewer mode)
 * Uses projectActionsStore directly for mutations.
 *
 * @returns {JSX.Element}
 */
export default function ReconcileTab() {
  const { projectId, getAssigneeName, getReconcilePath } = useProjectContext();
  const navigate = useNavigate();

  // Read from store directly
  const studies = () => projectStore.getStudies(projectId);

  // Filter studies that are in reconciliation workflow
  const studiesInReconciliation = createMemo(() => {
    return getStudiesForTab(studies(), 'reconcile', null);
  });

  // Navigation helpers
  const openReconciliation = (studyId, checklist1Id, checklist2Id) => {
    navigate(getReconcilePath(studyId, checklist1Id, checklist2Id));
  };

  const handleViewPdf = (studyId, pdf) => {
    projectActionsStore.pdf.view(studyId, pdf);
  };

  const handleDownloadPdf = (studyId, pdf) => {
    projectActionsStore.pdf.download(studyId, pdf);
  };

  return (
    <div class='space-y-2'>
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
        <div class='space-y-2'>
          <For each={studiesInReconciliation()}>
            {study => (
              <ReconcileStudyRow
                study={study}
                onReconcile={(checklist1Id, checklist2Id) =>
                  openReconciliation(study.id, checklist1Id, checklist2Id)
                }
                onViewPdf={pdf => handleViewPdf(study.id, pdf)}
                onDownloadPdf={pdf => handleDownloadPdf(study.id, pdf)}
                getAssigneeName={getAssigneeName}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
