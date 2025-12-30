import { Show, For, createSignal, createEffect, onCleanup } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useLocalChecklists } from '@primitives/useLocalChecklists.js';
import { useOrgContext } from '@primitives/useOrgContext.js';
import { useOrgProjectList } from '@primitives/useOrgProjectList.js';
import useRecentsNav from '@primitives/useRecentsNav.js';
import { useConfirmDialog, Tooltip } from '@corates/ui';
import { AiOutlineFolder, AiOutlineCloud, AiOutlineHome } from 'solid-icons/ai';
import { HiOutlineDocumentCheck } from 'solid-icons/hi';
import { FiChevronsLeft, FiChevronsRight, FiX, FiClock } from 'solid-icons/fi';
import ProjectTreeItem from './ProjectTreeItem.jsx';
import LocalChecklistItem from './LocalChecklistItem.jsx';

/**
 * Sidebar component with cloud projects and local checklists.
 * Desktop: always visible as expanded (w-64) or collapsed rail (w-12).
 * Mobile: overlay that slides in when mobileOpen is true.
 *
 * @param {Object} props
 * @param {'expanded' | 'collapsed'} props.desktopMode - Desktop sidebar mode
 * @param {boolean} props.mobileOpen - Whether mobile overlay is open
 * @param {() => void} props.onToggleDesktop - Toggle desktop mode
 * @param {() => void} props.onCloseMobile - Close mobile overlay
 */
export default function Sidebar(props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoggedIn } = useBetterAuth();
  const { checklists, deleteChecklist } = useLocalChecklists();

  // Get org context for org-scoped paths
  const { orgId, orgSlug, orgName } = useOrgContext();

  const currentUserId = () => user()?.id;

  // Track expanded projects and studies
  const [expandedProjects, setExpandedProjects] = createSignal({});
  const [expandedStudies, setExpandedStudies] = createSignal({});

  // Use TanStack Query for org-scoped project list
  const projectListQuery = useOrgProjectList(orgId, {
    enabled: () => isLoggedIn() && !!orgId(),
  });
  const cloudProjects = () => projectListQuery.projects();
  const isProjectsLoading = () => projectListQuery.isLoading();

  // Confirm dialog for delete actions
  const confirmDialog = useConfirmDialog();
  const [_pendingDeleteId, setPendingDeleteId] = createSignal(null);

  const isExpanded = () => props.desktopMode === 'expanded';

  // Track recent navigation
  const { recents } = useRecentsNav();

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

  // Build dashboard/workspace path based on org context
  const getWorkspacePath = () => {
    const slug = orgSlug();
    return slug ? `/orgs/${slug}` : '/dashboard';
  };

  // Get a label for a recent item based on its type and available data
  const getRecentItemLabel = item => {
    switch (item.type) {
      case 'project': {
        const project = cloudProjects()?.find(p => p.id === item.projectId);
        return project?.name || 'Project';
      }
      case 'study': {
        const project = cloudProjects()?.find(p => p.id === item.projectId);
        const study = project?.studies?.find(s => s.id === item.studyId);
        return study?.title || study?.name || 'Study';
      }
      case 'checklist': {
        return 'Checklist';
      }
      case 'local-checklist': {
        const checklist = checklists()?.find(c => c.id === item.checklistId);
        return checklist?.name || 'Appraisal';
      }
      default:
        return 'Item';
    }
  };

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

  // Close mobile sidebar on escape key
  createEffect(() => {
    if (!props.mobileOpen) return;
    const handleKeyDown = e => {
      if (e.key === 'Escape') props.onCloseMobile?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => document.removeEventListener('keydown', handleKeyDown));
  });

  // Close mobile sidebar when route changes
  createEffect(() => {
    location.pathname;
    if (props.mobileOpen) props.onCloseMobile?.();
  });

  return (
    <>
      {/* Mobile backdrop */}
      <Show when={props.mobileOpen}>
        <div
          class='fixed inset-0 z-40 bg-black/30 md:hidden'
          onClick={() => props.onCloseMobile?.()}
        />
      </Show>

      {/* Sidebar container */}
      <div
        class={`h-full shrink-0 border-r border-gray-200 bg-white transition-all duration-200 ease-in-out ${isExpanded() ? 'md:w-64' : 'md:w-12'} fixed top-12 left-0 z-50 w-64 md:static md:top-0 md:z-auto ${props.mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} `}
        style={{ 'max-width': '100vw' }}
      >
        <div class='flex h-full flex-col'>
          {/* Sidebar Header with toggle */}
          <div class='flex shrink-0 items-center border-b border-gray-100 p-2'>
            <Show
              when={isExpanded()}
              fallback={
                /* Collapsed rail: just the expand button */
                <Tooltip content='Expand sidebar' positioning={{ placement: 'right' }}>
                  <button
                    onClick={() => props.onToggleDesktop?.()}
                    class='hidden h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 md:flex'
                    aria-label='Expand sidebar'
                  >
                    <FiChevronsRight class='h-4 w-4' />
                  </button>
                </Tooltip>
              }
            >
              {/* Expanded: workspace name + collapse button */}
              <span class='flex-1 truncate px-2 text-sm font-semibold text-gray-700'>
                {orgName() || 'CoRATES'}
              </span>
              <Tooltip content='Collapse sidebar' positioning={{ placement: 'right' }}>
                <button
                  onClick={() => props.onToggleDesktop?.()}
                  class='hidden h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 md:flex'
                  aria-label='Collapse sidebar'
                >
                  <FiChevronsLeft class='h-4 w-4' />
                </button>
              </Tooltip>
            </Show>

            {/* Mobile close button (always visible on mobile when open) */}
            <button
              onClick={() => props.onCloseMobile?.()}
              class='ml-auto flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 md:hidden'
              aria-label='Close sidebar'
            >
              <FiX class='h-4 w-4' />
            </button>
          </div>

          {/* Expanded content */}
          <Show when={isExpanded()}>
            <div class='sidebar-scrollbar flex-1 overflow-x-hidden overflow-y-auto'>
              {/* Dashboard/Workspace Link */}
              <div class='p-2 pt-3'>
                <button
                  onClick={() => navigate(getWorkspacePath())}
                  class={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isCurrentPath(getWorkspacePath()) || isCurrentPath('/dashboard') ?
                      'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <AiOutlineHome class='h-4 w-4 shrink-0' />
                  <span class='truncate'>{orgName() || 'Workspace'}</span>
                </button>
              </div>

              {/* Recents Section */}
              <Show when={recents().length > 0}>
                <div class='px-3 pt-4 pb-2'>
                  <h3 class='flex items-center gap-1.5 text-xs font-semibold tracking-wider text-gray-500 uppercase'>
                    <FiClock class='h-3 w-3' />
                    Recent
                  </h3>
                </div>
                <div class='space-y-0.5 px-2'>
                  <For each={recents().slice(0, 5)}>
                    {item => (
                      <button
                        onClick={() => navigate(item.path)}
                        class={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                          isCurrentPath(item.path) ?
                            'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <Show
                          when={item.type === 'project'}
                          fallback={
                            <Show
                              when={item.type === 'study'}
                              fallback={
                                <HiOutlineDocumentCheck class='h-3.5 w-3.5 shrink-0 text-gray-400' />
                              }
                            >
                              <AiOutlineFolder class='h-3.5 w-3.5 shrink-0 text-gray-400' />
                            </Show>
                          }
                        >
                          <AiOutlineCloud class='h-3.5 w-3.5 shrink-0 text-gray-400' />
                        </Show>
                        <span class='truncate text-xs'>{getRecentItemLabel(item)}</span>
                      </button>
                    )}
                  </For>
                </div>
              </Show>

              {/* Cloud Projects Section */}
              <Show when={isLoggedIn() && orgSlug()}>
                <div class='px-3 pt-4 pb-2'>
                  <h3 class='flex items-center gap-1.5 text-xs font-semibold tracking-wider text-gray-500 uppercase'>
                    <AiOutlineCloud class='h-3 w-3' />
                    Projects
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
                            onClick={() => navigate(getWorkspacePath())}
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
                          orgSlug={orgSlug()}
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
                        onClick={() => navigate('/checklist')}
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
          </Show>

          {/* Collapsed rail content (desktop only) */}
          <Show when={!isExpanded()}>
            <div class='hidden flex-1 flex-col items-center gap-1 overflow-y-auto py-2 md:flex'>
              {/* Home/Workspace icon */}
              <Tooltip content={orgName() || 'Workspace'} positioning={{ placement: 'right' }}>
                <button
                  onClick={() => navigate(getWorkspacePath())}
                  class={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                    isCurrentPath(getWorkspacePath()) || isCurrentPath('/dashboard') ?
                      'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                  aria-label={orgName() || 'Workspace'}
                >
                  <AiOutlineHome class='h-4 w-4' />
                </button>
              </Tooltip>

              {/* Projects icon */}
              <Show when={isLoggedIn() && orgSlug()}>
                <Tooltip content='Projects' positioning={{ placement: 'right' }}>
                  <button
                    onClick={() => {
                      props.onToggleDesktop?.();
                    }}
                    class='flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700'
                    aria-label='Projects'
                  >
                    <AiOutlineCloud class='h-4 w-4' />
                  </button>
                </Tooltip>
              </Show>

              {/* Appraisals icon */}
              <Tooltip content='Appraisals' positioning={{ placement: 'right' }}>
                <button
                  onClick={() => {
                    props.onToggleDesktop?.();
                  }}
                  class='flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700'
                  aria-label='Appraisals'
                >
                  <HiOutlineDocumentCheck class='h-4 w-4' />
                </button>
              </Tooltip>
            </div>
          </Show>
        </div>

        <confirmDialog.ConfirmDialogComponent />
      </div>
    </>
  );
}
