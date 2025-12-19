import { Show, For, createSignal, createEffect } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { useBetterAuth } from '@/api/betterAuthStore.js';
import { useLocalChecklists } from '@primitives/useLocalChecklists.js';
import projectStore from '@/stores/projectStore.js';
import { useConfirmDialog } from '@corates/ui';
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

  const currentUserId = () => user()?.id;

  // Track expanded projects and studies
  const [expandedProjects, setExpandedProjects] = createSignal({});
  const [expandedStudies, setExpandedStudies] = createSignal({});

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

  const toggleStudy = studyId => {
    setExpandedStudies(prev => ({
      ...prev,
      [studyId]: !prev[studyId],
    }));
  };

  const isStudyExpanded = studyId => expandedStudies()[studyId] || false;

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
      class={`h-full shrink-0 overflow-x-hidden border-r border-gray-200 bg-white transition-all duration-200 ease-in-out ${props.open ? 'w-64' : 'w-0'} md:relative ${props.open ? '' : 'md:w-0'} fixed top-12 left-0 z-30 md:static md:z-auto ${props.open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} `}
      style={{ 'max-width': '100vw' }}
    >
      <div
        class={`flex h-full w-64 flex-col transition-opacity duration-100 ${props.open ? 'pointer-events-auto opacity-100 duration-500' : 'pointer-events-none opacity-0'} `}
      >
        {/* Main Content */}
        <div class='sidebar-scrollbar flex-1 overflow-y-auto'>
          {/* Dashboard Link */}
          <div class='p-2 pt-4'>
            <button
              onClick={() => navigate('/dashboard')}
              class={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isCurrentPath('/dashboard') ?
                  'bg-blue-100 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <AiOutlineHome class='h-4 w-4' />
              Dashboard
            </button>
          </div>

          {/* Cloud Projects Section - Only show when logged in */}
          <Show when={isLoggedIn()}>
            <div class='px-3 pt-4 pb-2'>
              <h3 class='flex items-center gap-1.5 text-xs font-semibold tracking-wider text-gray-500 uppercase'>
                <AiOutlineCloud class='h-3 w-3' />
                Cloud Projects
              </h3>
            </div>
            <div class='space-y-0.5 px-2'>
              <Show
                when={cloudProjects()?.length > 0}
                fallback={
                  <Show when={!isProjectsLoading()}>
                    <div class='px-2 py-4 text-center'>
                      <div class='mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100'>
                        <AiOutlineFolder class='h-4 w-4 text-gray-400' />
                      </div>
                      <p class='text-xs font-medium text-gray-500'>No projects yet</p>
                      <button
                        onClick={() => navigate('/dashboard')}
                        class='mt-1 text-xs text-blue-600 hover:text-blue-700'
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
                      userId={currentUserId()}
                      currentPath={location.pathname}
                      isStudyExpanded={isStudyExpanded}
                      onToggleStudy={toggleStudy}
                    />
                  )}
                </For>
              </Show>
            </div>
          </Show>

          {/* Local Checklists Section */}
          <div class='px-3 pt-6 pb-2'>
            <h3 class='flex items-center gap-1.5 text-xs font-semibold tracking-wider text-gray-500 uppercase'>
              <HiOutlineDocumentCheck class='h-3 w-3' />
              Appraisals
            </h3>
          </div>
          <div class='space-y-0.5 px-2'>
            <Show
              when={checklists()?.length > 0}
              fallback={
                <div class='px-2 py-4 text-center'>
                  <div class='mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100'>
                    <HiOutlineDocumentCheck class='h-4 w-4 text-gray-400' />
                  </div>
                  <p class='text-xs font-medium text-gray-500'>No appraisals</p>
                  <button
                    onClick={() => navigate('/checklist/new')}
                    class='mt-1 text-xs text-blue-600 hover:text-blue-700'
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
