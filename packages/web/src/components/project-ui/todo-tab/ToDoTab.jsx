import { For, Show, createMemo, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { BsListTask } from 'solid-icons/bs';
import TodoStudyRow from './TodoStudyRow.jsx';
import projectStore from '@/stores/projectStore.js';
import projectActionsStore from '@/stores/projectActionsStore';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useProjectContext } from '../ProjectContext.jsx';
import { getStudiesForTab } from '@/lib/checklist-domain.js';

/**
 * ToDoTab - Shows studies assigned to the current user in compact rows
 * Uses projectActionsStore directly for mutations.
 */
export default function ToDoTab() {
  const { projectId } = useProjectContext();
  const { user } = useBetterAuth();
  const navigate = useNavigate();

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
    return getStudiesForTab(studies(), 'todo', userId);
  });

  // Handlers
  const handleCreateChecklist = async (studyId, type, assigneeId) => {
    setCreatingChecklist(true);
    try {
      const success = projectActionsStore.checklist.create(studyId, type, assigneeId);
      if (success) setShowChecklistForm(null);
    } finally {
      setCreatingChecklist(false);
    }
  };

  const openChecklist = (studyId, checklistId) => {
    navigate(`/projects/${projectId}/studies/${studyId}/checklists/${checklistId}`);
  };

  const handleViewPdf = (studyId, pdf) => {
    projectActionsStore.pdf.view(studyId, pdf);
  };

  const handleDownloadPdf = (studyId, pdf) => {
    projectActionsStore.pdf.download(studyId, pdf);
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
              onOpenChecklist={checklistId => openChecklist(study.id, checklistId)}
              onViewPdf={pdf => handleViewPdf(study.id, pdf)}
              onDownloadPdf={pdf => handleDownloadPdf(study.id, pdf)}
              creatingChecklist={creatingChecklist()}
            />
          )}
        </For>
      </Show>
    </div>
  );
}
