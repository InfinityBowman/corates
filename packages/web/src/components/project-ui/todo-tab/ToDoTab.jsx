import { For, Show, createMemo, createSignal } from 'solid-js';
import { BsListTask } from 'solid-icons/bs';
import TodoStudyRow from './TodoStudyRow.jsx';
import projectStore from '@/stores/projectStore.js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useProjectContext } from '../ProjectContext.jsx';

/**
 * ToDoTab - Shows studies assigned to the current user in compact rows
 * Uses ProjectContext for projectId, handlers, and helpers
 */
export default function ToDoTab() {
  const { projectId, handlers } = useProjectContext();
  const { checklistHandlers, pdfHandlers } = handlers;
  const { user } = useBetterAuth();

  // Local UI state
  const [showChecklistForm, setShowChecklistForm] = createSignal(null);
  const [creatingChecklist, setCreatingChecklist] = createSignal(false);

  // Read from store directly
  const studies = () => projectStore.getStudies(projectId);
  const members = () => projectStore.getMembers(projectId);
  const connectionState = () => projectStore.getConnectionState(projectId);
  const hasData = () => connectionState().synced || studies().length > 0;
  const currentUserId = () => user()?.id;

  // Filter studies to only show ones assigned to the current user
  // Exclude completed checklists - they move to reconcile or completed tabs
  const myStudies = createMemo(() => {
    const userId = currentUserId();
    if (!userId) return [];
    return (
      studies()
        .filter(study => study.reviewer1 === userId || study.reviewer2 === userId)
        .map(study => {
          const originalChecklists = study.checklists || [];
          // Check if user has any checklist (completed or not)
          const userHasChecklist = originalChecklists.some(c => c.assignedTo === userId);
          // Filter to only show the current user's non-completed checklists
          const activeChecklists = originalChecklists.filter(
            c => c.assignedTo === userId && c.status !== 'completed',
          );
          return {
            ...study,
            checklists: activeChecklists,
            // Flag to indicate if user needs to create a checklist
            _needsChecklist: !userHasChecklist,
          };
        })
        // Only show studies that have active checklists OR need a checklist created
        .filter(study => study.checklists.length > 0 || study._needsChecklist)
    );
  });

  // Wrap checklist creation to manage local loading state
  const handleCreateChecklist = async (studyId, type, assigneeId) => {
    setCreatingChecklist(true);
    try {
      const success = await checklistHandlers.handleCreateChecklist(studyId, type, assigneeId);
      if (success) setShowChecklistForm(null);
    } finally {
      setCreatingChecklist(false);
    }
  };

  return (
    <div class='space-y-2'>
      {/* Studies List */}
      <Show
        when={myStudies().length > 0}
        fallback={
          <Show when={hasData()}>
            <div class='py-16 text-center'>
              <BsListTask class='mx-auto mb-4 h-12 w-12 text-gray-300' />
              <h3 class='mb-2 text-lg font-medium text-gray-900'>To Do</h3>
              <p class='mx-auto max-w-md text-gray-500'>
                Studies assigned to you will appear here. Complete your appraisals to move them to
                the next stage.
              </p>
            </div>
          </Show>
        }
      >
        <For each={myStudies()}>
          {study => (
            <TodoStudyRow
              study={study}
              members={members()}
              currentUserId={currentUserId()}
              showChecklistForm={showChecklistForm() === study.id}
              onToggleChecklistForm={() =>
                setShowChecklistForm(prev => (prev === study.id ? null : study.id))
              }
              onAddChecklist={(type, assigneeId) =>
                handleCreateChecklist(study.id, type, assigneeId)
              }
              onOpenChecklist={checklistId =>
                checklistHandlers.openChecklist(study.id, checklistId)
              }
              onViewPdf={pdf => pdfHandlers.handleViewPdf(study.id, pdf)}
              onDownloadPdf={pdf => pdfHandlers.handleDownloadPdf(study.id, pdf)}
              creatingChecklist={creatingChecklist()}
            />
          )}
        </For>
      </Show>
    </div>
  );
}
