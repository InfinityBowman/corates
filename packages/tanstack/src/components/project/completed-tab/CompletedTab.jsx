import { For, Show, createMemo } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { AiFillCheckCircle } from 'solid-icons/ai';
import projectStore from '@/stores/projectStore.js';
import projectActionsStore from '@/stores/projectActionsStore';
import { useProjectContext } from '@/components/project/ProjectContext.jsx';
import { getStudiesForTab, isDualReviewerStudy } from '@/lib/checklist-domain.js';
import useProject from '@/primitives/useProject/index.js';
import CompletedStudyRow from './CompletedStudyRow.jsx';

/**
 * CompletedTab - Shows studies that have completed review
 * Uses projectActionsStore directly for mutations.
 */
export default function CompletedTab() {
  const { projectId, getAssigneeName } = useProjectContext();
  const navigate = useNavigate();
  const { getReconciliationProgress } = useProject(projectId);

  const studies = () => projectStore.getStudies(projectId);

  const completedStudies = createMemo(() => {
    return getStudiesForTab(studies(), 'completed', null);
  });

  // Navigation helpers
  const openChecklist = (studyId, checklistId) => {
    navigate({ to: `/projects/${projectId}/studies/${studyId}/checklists/${checklistId}?tab=completed` });
  };

  const handleViewPdf = (studyId, pdf) => {
    projectActionsStore.pdf.view(studyId, pdf);
  };

  const handleDownloadPdf = (studyId, pdf) => {
    projectActionsStore.pdf.download(studyId, pdf);
  };

  // Get reconciliation progress for a study
  const getReconciliationProgressForStudy = study => {
    // Only get reconciliation progress for dual-reviewer studies
    if (!isDualReviewerStudy(study)) return null;
    return getReconciliationProgress(study.id);
  };

  return (
    <div class='space-y-2'>
      <Show
        when={completedStudies().length > 0}
        fallback={
          <div class='py-16 text-center'>
            <AiFillCheckCircle class='mx-auto mb-4 h-12 w-12 text-gray-300' />
            <h3 class='mb-2 text-lg font-medium text-gray-900'>Completed</h3>
            <p class='mx-auto max-w-md text-gray-500'>
              Studies that have completed reconciliation will appear here.
            </p>
          </div>
        }
      >
        <For each={completedStudies()}>
          {study => (
            <CompletedStudyRow
              study={study}
              onOpenChecklist={checklistId => openChecklist(study.id, checklistId)}
              onViewPdf={pdf => handleViewPdf(study.id, pdf)}
              onDownloadPdf={pdf => handleDownloadPdf(study.id, pdf)}
              reconciliationProgress={getReconciliationProgressForStudy(study)}
              getAssigneeName={getAssigneeName}
            />
          )}
        </For>
      </Show>
    </div>
  );
}
