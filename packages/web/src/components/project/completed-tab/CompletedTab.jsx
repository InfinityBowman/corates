import { For, Show, createMemo } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { AiFillCheckCircle } from 'solid-icons/ai';
import projectStore from '@/stores/projectStore.js';
import projectActionsStore from '@/stores/projectActionsStore';
import { useProjectContext } from '@/components/project/ProjectContext.jsx';
import { getStudiesForTab, isDualReviewerStudy, getOutcomeKey } from '@/lib/checklist-domain.js';
import useProject from '@/primitives/useProject/index.js';
import CompletedStudyRow from './CompletedStudyRow.jsx';

/**
 * CompletedTab - Shows studies that have completed review
 * Supports multiple outcomes per study with outcome-aware reconciliation progress lookup.
 * Uses projectActionsStore directly for mutations.
 */
export default function CompletedTab() {
  const { projectId, getAssigneeName, getChecklistPath } = useProjectContext();
  const navigate = useNavigate();
  const { getAllReconciliationProgress } = useProject(projectId);

  const studies = () => projectStore.getStudies(projectId);
  const meta = () => projectStore.getMeta(projectId);

  // Helper to get outcome name by ID
  const getOutcomeName = outcomeId => {
    if (!outcomeId) return null;
    const outcomes = meta()?.outcomes || [];
    const outcome = outcomes.find(o => o.id === outcomeId);
    return outcome?.name || null;
  };

  const completedStudies = createMemo(() => {
    return getStudiesForTab(studies(), 'completed', null);
  });

  // Navigation helpers
  const openChecklist = (studyId, checklistId) => {
    navigate(getChecklistPath(studyId, checklistId, 'completed'));
  };

  const handleViewPdf = (studyId, pdf) => {
    projectActionsStore.pdf.view(studyId, pdf);
  };

  const handleDownloadPdf = (studyId, pdf) => {
    projectActionsStore.pdf.download(studyId, pdf);
  };

  // Create a function to get reconciliation progress for a specific outcome within a study
  // Returns a reactive getter that reads progress fresh each time
  const createReconciliationProgressGetter = studyId => {
    // Only get reconciliation progress for dual-reviewer studies
    const study = studies().find(s => s.id === studyId);
    if (!study || !isDualReviewerStudy(study)) {
      return () => null;
    }

    // Return a function that fetches progress fresh each call (reactive)
    return (outcomeId, type) => {
      const allProgress = getAllReconciliationProgress(studyId) || [];
      const outcomeKey = getOutcomeKey(outcomeId, type);
      const entry = allProgress.find(p => p.outcomeKey === outcomeKey);
      return entry || null;
    };
  };

  return (
    <div class='space-y-2'>
      <Show
        when={completedStudies().length > 0}
        fallback={
          <div class='py-16 text-center'>
            <AiFillCheckCircle class='text-muted-foreground/50 mx-auto mb-4 h-12 w-12' />
            <h3 class='text-foreground mb-2 text-lg font-medium'>Completed</h3>
            <p class='text-muted-foreground mx-auto max-w-md'>
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
              getReconciliationProgress={createReconciliationProgressGetter(study.id)}
              getAssigneeName={getAssigneeName}
              getOutcomeName={getOutcomeName}
            />
          )}
        </For>
      </Show>
    </div>
  );
}
