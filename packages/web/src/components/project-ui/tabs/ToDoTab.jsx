import { For, Show, createMemo, createSignal } from 'solid-js';
import StudyCard from '../StudyCard.jsx';
import projectStore from '@primitives/projectStore.js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useProjectContext } from '../ProjectContext.jsx';

/**
 * ToDoTab - Shows studies assigned to the current user
 * Uses ProjectContext for projectId, handlers, and helpers
 */
export default function ToDoTab() {
  const { projectId, handlers, getAssigneeName } = useProjectContext();
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
  // Also filter checklists so reviewers only see their own
  const myStudies = createMemo(() => {
    const userId = currentUserId();
    if (!userId) return [];
    return studies()
      .filter(study => study.reviewer1 === userId || study.reviewer2 === userId)
      .map(study => ({
        ...study,
        // Filter checklists to only show the current user's checklists
        checklists: (study.checklists || []).filter(c => c.assignedTo === userId),
      }));
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
    <div class='space-y-6'>
      {/* Studies List */}
      <Show
        when={myStudies().length > 0}
        fallback={
          <Show when={hasData()}>
            <div class='text-center py-12 bg-gray-50 rounded-lg'>
              <p class='text-gray-500'>No studies assigned to you yet.</p>
            </div>
          </Show>
        }
      >
        <div class='space-y-4'>
          <For each={myStudies()}>
            {study => (
              <StudyCard
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
                onUpdateChecklist={(checklistId, updates) =>
                  checklistHandlers.handleUpdateChecklist(study.id, checklistId, updates)
                }
                onDeleteChecklist={checklistId =>
                  checklistHandlers.handleDeleteChecklist(study.id, checklistId)
                }
                getAssigneeName={getAssigneeName}
                creatingChecklist={creatingChecklist()}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
