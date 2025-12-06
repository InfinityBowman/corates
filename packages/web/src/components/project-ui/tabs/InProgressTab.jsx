import { For, Show, createMemo, createSignal } from 'solid-js';
import StudyCard from '../StudyCard.jsx';
import projectStore from '@primitives/projectStore.js';
import { useBetterAuth } from '@api/better-auth-store.js';

/**
 * InProgressTab - Shows studies assigned to the current user
 *
 * Props:
 * - projectId: string - The project ID
 * - checklistHandlers: { handleCreateChecklist, handleUpdateChecklist, handleDeleteChecklist, openChecklist, openReconciliation }
 * - pdfHandlers: { handleViewPdf }
 * - getAssigneeName: (userId) => string
 */
export default function InProgressTab(props) {
  const { user } = useBetterAuth();

  // Local UI state
  const [showChecklistForm, setShowChecklistForm] = createSignal(null);
  const [creatingChecklist, setCreatingChecklist] = createSignal(false);

  // Read from store directly
  const studies = () => projectStore.getStudies(props.projectId);
  const members = () => projectStore.getMembers(props.projectId);
  const connectionState = () => projectStore.getConnectionState(props.projectId);
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
      const success = await props.checklistHandlers.handleCreateChecklist(
        studyId,
        type,
        assigneeId,
      );
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
                projectId={props.projectId}
                currentUserId={currentUserId()}
                showChecklistForm={showChecklistForm() === study.id}
                onToggleChecklistForm={() =>
                  setShowChecklistForm(prev => (prev === study.id ? null : study.id))
                }
                onAddChecklist={(type, assigneeId) =>
                  handleCreateChecklist(study.id, type, assigneeId)
                }
                onOpenChecklist={checklistId =>
                  props.checklistHandlers.openChecklist(study.id, checklistId)
                }
                onReconcile={(checklist1Id, checklist2Id) =>
                  props.checklistHandlers.openReconciliation(study.id, checklist1Id, checklist2Id)
                }
                onViewPdf={pdf => props.pdfHandlers.handleViewPdf(study.id, pdf)}
                onUpdateChecklist={(checklistId, updates) =>
                  props.checklistHandlers.handleUpdateChecklist(study.id, checklistId, updates)
                }
                onDeleteChecklist={checklistId =>
                  props.checklistHandlers.handleDeleteChecklist(study.id, checklistId)
                }
                getAssigneeName={props.getAssigneeName}
                creatingChecklist={creatingChecklist()}
                hideManagementActions={true}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
