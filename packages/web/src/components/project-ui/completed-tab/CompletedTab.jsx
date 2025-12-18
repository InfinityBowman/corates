import { For, Show, createMemo } from 'solid-js';
import { AiFillCheckCircle } from 'solid-icons/ai';
import projectStore from '@/stores/projectStore.js';
import { useProjectContext } from '@project-ui/ProjectContext.jsx';
import CompletedStudyCard from './CompletedStudyCard.jsx';

export default function CompletedTab() {
  const { projectId, handlers } = useProjectContext();
  const { checklistHandlers, pdfHandlers } = handlers;

  const studies = () => projectStore.getStudies(projectId);

  const completedStudies = createMemo(() => {
    return studies().filter(study => {
      const checklists = study.checklists || [];

      // Single reviewer: completed checklist goes directly to completed
      const isSingleReviewer = study.reviewer1 && !study.reviewer2;
      if (isSingleReviewer) {
        return checklists.some(c => c.status === 'completed');
      }

      // Dual reviewer: only show when reconciled
      return checklists.some(c => c.isReconciled);
    });
  });

  return (
    <div class='space-y-6'>
      <Show
        when={completedStudies().length > 0}
        fallback={
          <div class='text-center py-16'>
            <AiFillCheckCircle class='w-12 h-12 text-gray-300 mx-auto mb-4' />
            <h3 class='text-lg font-medium text-gray-900 mb-2'>Completed</h3>
            <p class='text-gray-500 max-w-md mx-auto'>
              Studies that have completed reconciliation will appear here.
            </p>
          </div>
        }
      >
        <div class='space-y-4'>
          <For each={completedStudies()}>
            {study => (
              <CompletedStudyCard
                study={study}
                onOpenChecklist={checklistId =>
                  checklistHandlers.openChecklist(study.id, checklistId)
                }
                onViewPdf={pdf => pdfHandlers.handleViewPdf(study.id, pdf)}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
