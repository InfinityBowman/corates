import { Show, For, createSignal, createEffect } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useLocalChecklists } from '@primitives/useLocalChecklists.js';
import projectStore from '@primitives/projectStore.js';
import { useConfirmDialog } from '@components/zag/Dialog.jsx';
import { AiOutlineFolder } from 'solid-icons/ai';
import { AiOutlineCloud } from 'solid-icons/ai';
import { HiOutlineDocumentCheck } from 'solid-icons/hi';
import { AiOutlineHome } from 'solid-icons/ai';
import ProjectTreeItem from './ProjectTreeItem.jsx';
import LocalChecklistItem from './LocalChecklistItem.jsx';

/**
 * Sidebar component with cloud projects and local checklists
 */
export default function Sidebar(props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoggedIn } = useBetterAuth();
  const { checklists, deleteChecklist } = useLocalChecklists();

  // Track expanded projects
  const [expandedProjects, setExpandedProjects] = createSignal({});

  // Read cloud projects from the store (same data as dashboard)
  const cloudProjects = () => projectStore.getProjectList();
  const isProjectsLoading = () => projectStore.isProjectListLoading();

  // Confirm dialog for delete actions
  const confirmDialog = useConfirmDialog();
  const [_pendingDeleteId, setPendingDeleteId] = createSignal(null);

  // Fetch projects if user is logged in
  createEffect(() => {
    const userId = user()?.id;
    if (isLoggedIn() && userId) {
      projectStore.fetchProjectList(userId);
    }
  });

  const toggleProject = projectId => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const isCurrentPath = path => location.pathname === path;

  const handleDeleteLocalChecklist = async (e, checklistId) => {
    e.stopPropagation();
    setPendingDeleteId(checklistId);
    const confirmed = await confirmDialog.open({
      title: 'Delete Checklist',
      description: 'Are you sure you want to delete this checklist? This cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (confirmed) {
      await deleteChecklist(checklistId);
    }
    setPendingDeleteId(null);
  };

  return (
    <div
      class={`
        transition-all duration-200 ease-in-out
        bg-white border-r border-gray-200 h-full overflow-x-hidden shrink-0
        ${props.open ? 'w-64' : 'w-0'}
        md:relative
        ${props.open ? '' : 'md:w-0'}
        fixed top-12 left-0 z-30 md:static md:z-auto
        ${props.open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
      style={{ 'max-width': '100vw' }}
    >
      <div
        class={`
          flex flex-col h-full w-64
          transition-opacity duration-100
          ${props.open ? 'duration-500 opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
      >
        {/* Main Content */}
        <div class='flex-1 overflow-y-auto sidebar-scrollbar'>
          {/* Dashboard Link */}
          <div class='p-2 pt-4'>
            <button
              onClick={() => navigate('/dashboard')}
              class={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isCurrentPath('/dashboard') ?
                  'bg-blue-100 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <AiOutlineHome class='w-4 h-4' />
              Dashboard
            </button>
          </div>

          {/* Cloud Projects Section - Only show when logged in */}
          <Show when={isLoggedIn()}>
            <div class='px-3 pt-4 pb-2'>
              <h3 class='text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5'>
                <AiOutlineCloud class='w-3 h-3' />
                Cloud Projects
              </h3>
            </div>
            <div class='px-2 space-y-0.5'>
              <Show
                when={cloudProjects()?.length > 0}
                fallback={
                  <Show when={!isProjectsLoading()}>
                    <div class='text-center py-4 px-2'>
                      <div class='w-8 h-8 bg-gray-100 rounded-lg mx-auto mb-2 flex items-center justify-center'>
                        <AiOutlineFolder class='w-4 h-4 text-gray-400' />
                      </div>
                      <p class='text-xs text-gray-500 font-medium'>No projects yet</p>
                      <button
                        onClick={() => navigate('/dashboard')}
                        class='text-xs text-blue-600 hover:text-blue-700 mt-1'
                      >
                        Create a project
                      </button>
                    </div>
                  </Show>
                }
              >
                <For each={cloudProjects()}>
                  {project => (
                    <ProjectTreeItem
                      project={project}
                      isExpanded={expandedProjects()[project.id]}
                      onToggle={() => toggleProject(project.id)}
                      currentPath={location.pathname}
                    />
                  )}
                </For>
              </Show>
            </div>
          </Show>

          {/* Local Checklists Section */}
          <div class='px-3 pt-6 pb-2'>
            <h3 class='text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5'>
              <HiOutlineDocumentCheck class='w-3 h-3' />
              Local Checklists
            </h3>
          </div>
          <div class='px-2 space-y-0.5'>
            <Show
              when={checklists()?.length > 0}
              fallback={
                <div class='text-center py-4 px-2'>
                  <div class='w-8 h-8 bg-gray-100 rounded-lg mx-auto mb-2 flex items-center justify-center'>
                    <HiOutlineDocumentCheck class='w-4 h-4 text-gray-400' />
                  </div>
                  <p class='text-xs text-gray-500 font-medium'>No local checklists</p>
                  <button
                    onClick={() => navigate('/checklist/new')}
                    class='text-xs text-blue-600 hover:text-blue-700 mt-1'
                  >
                    Create one
                  </button>
                </div>
              }
            >
              <For each={checklists()?.filter(c => c?.id)}>
                {checklist => (
                  <LocalChecklistItem
                    checklist={checklist}
                    isSelected={location.pathname === `/checklist/${checklist.id}`}
                    onDelete={handleDeleteLocalChecklist}
                  />
                )}
              </For>
            </Show>
          </div>

          {/* Bottom spacer */}
          <div class='h-8' />
        </div>
      </div>

      <confirmDialog.ConfirmDialogComponent />
    </div>
  );
}
