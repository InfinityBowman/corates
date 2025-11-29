import { Show, For, createSignal, createResource } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useLocalChecklists } from '@primitives/useLocalChecklists.js';
import { useProject } from '@primitives/useProject.js';
import { API_BASE } from '@config/api.js';
import Collapsible from '@components/zag/Collapsible.jsx';
import { AiOutlineFolder, AiOutlineFolderOpen } from 'solid-icons/ai';
import { AiOutlineCloud } from 'solid-icons/ai';
import { HiOutlineDocumentCheck } from 'solid-icons/hi';
import { BiRegularTrash } from 'solid-icons/bi';
import { AiOutlineHome } from 'solid-icons/ai';
import { VsBook } from 'solid-icons/vs';

export default function Sidebar(props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoggedIn } = useBetterAuth();
  const { checklists, deleteChecklist } = useLocalChecklists();

  // Track expanded projects
  const [expandedProjects, setExpandedProjects] = createSignal({});

  // Fetch cloud projects for logged-in users
  const [cloudProjects] = createResource(
    () => isLoggedIn() && user()?.id,
    async userId => {
      if (!userId) return [];
      try {
        const response = await fetch(`${API_BASE}/api/users/${userId}/projects`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) return [];
        return await response.json();
      } catch (error) {
        console.error('Error fetching projects:', error);
        return [];
      }
    }
  );

  const toggleProject = projectId => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const isCurrentPath = path => location.pathname === path;

  const handleDeleteLocalChecklist = async (e, checklistId) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this checklist? This cannot be undone.')) {
      await deleteChecklist(checklistId);
    }
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
      style='max-width: 100vw;'
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
                isCurrentPath('/dashboard')
                  ? 'bg-blue-100 text-blue-700'
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
                  <Show when={!cloudProjects.loading}>
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
              <For each={checklists()}>
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
    </div>
  );
}

/**
 * Project tree item with expandable studies using Zag collapsible
 */
function ProjectTreeItem(props) {
  const navigate = useNavigate();
  const projectPath = () => `/projects/${props.project.id}`;
  const isSelected = () => props.currentPath === projectPath();

  // Use project hook to get studies when expanded
  const project = useProject(props.project.id);

  return (
    <Collapsible
      open={props.isExpanded}
      onOpenChange={open => {
        if (open !== props.isExpanded) {
          props.onToggle();
        }
      }}
      trigger={api => (
        <div
          class={`
            flex items-center group rounded-lg transition-colors cursor-pointer
            ${isSelected() ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}
          `}
        >
          <button
            {...api.getTriggerProps()}
            class='p-2 hover:bg-gray-100 rounded-l-lg'
            aria-label={props.isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg
              class={`w-3 h-3 text-gray-500 transition-transform ${props.isExpanded ? 'rotate-90' : ''}`}
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M9 5l7 7-7 7' />
            </svg>
          </button>
          <button
            onClick={() => navigate(projectPath())}
            class='flex-1 flex items-center gap-2 py-2 pr-2 text-left'
          >
            <Show
              when={props.isExpanded}
              fallback={<AiOutlineFolder class='w-4 h-4 text-gray-500' />}
            >
              <AiOutlineFolderOpen class='w-4 h-4 text-blue-500' />
            </Show>
            <span class='text-sm font-medium truncate'>{props.project.name}</span>
          </button>
        </div>
      )}
    >
      {/* Studies list */}
      <div class='ml-6 pl-2 border-l border-gray-200 mt-0.5 space-y-0.5'>
        <Show
          when={project.studies()?.length > 0}
          fallback={
            <Show
              when={project.connecting() || !project.synced()}
              fallback={<div class='py-2 px-2 text-xs text-gray-500'>No studies yet</div>}
            >
              <div class='py-2 px-2 text-xs text-gray-400'>Loading...</div>
            </Show>
          }
        >
          <For each={project.studies()}>
            {study => (
              <StudyTreeItem
                study={study}
                projectId={props.project.id}
                currentPath={props.currentPath}
              />
            )}
          </For>
        </Show>
      </div>
    </Collapsible>
  );
}

/**
 * Study tree item with expandable checklists
 */
function StudyTreeItem(props) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = createSignal(false);

  return (
    <Collapsible
      open={isExpanded()}
      onOpenChange={setIsExpanded}
      trigger={api => (
        <div class='flex items-center group rounded transition-colors text-gray-600 hover:bg-gray-50'>
          <button
            {...api.getTriggerProps()}
            class='p-1.5 hover:bg-gray-100 rounded'
            aria-label={isExpanded() ? 'Collapse' : 'Expand'}
          >
            <svg
              class={`w-2.5 h-2.5 text-gray-400 transition-transform ${isExpanded() ? 'rotate-90' : ''}`}
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M9 5l7 7-7 7' />
            </svg>
          </button>
          <div class='flex-1 flex items-center gap-1.5 py-1.5 pr-2 text-left'>
            <VsBook class='w-3.5 h-3.5 text-gray-400' />
            <span class='text-xs font-medium truncate'>{props.study.name}</span>
          </div>
        </div>
      )}
    >
      {/* Checklists list */}
      <div class='ml-4 pl-2 border-l border-gray-100 mt-0.5 space-y-0.5'>
        <Show
          when={props.study.checklists?.length > 0}
          fallback={<div class='py-1 px-2 text-2xs text-gray-400'>No checklists</div>}
        >
          <For each={props.study.checklists}>
            {checklist => (
              <ChecklistTreeItem
                checklist={checklist}
                projectId={props.projectId}
                studyId={props.study.id}
                currentPath={props.currentPath}
              />
            )}
          </For>
        </Show>
      </div>
    </Collapsible>
  );
}

/**
 * Checklist tree item (leaf node)
 */
function ChecklistTreeItem(props) {
  const navigate = useNavigate();
  const checklistPath = () =>
    `/projects/${props.projectId}/studies/${props.studyId}/checklists/${props.checklist.id}`;
  const isSelected = () => props.currentPath === checklistPath();

  return (
    <button
      onClick={() => navigate(checklistPath())}
      class={`
        w-full flex items-center gap-1.5 px-2 py-1 rounded text-left transition-colors
        ${isSelected() ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}
      `}
    >
      <HiOutlineDocumentCheck class='w-3 h-3 shrink-0' />
      <span class='text-2xs font-medium truncate'>{props.checklist.type || 'Checklist'}</span>
      <Show when={props.checklist.status}>
        <span
          class={`text-3xs px-1 py-0.5 rounded ${
            props.checklist.status === 'completed'
              ? 'bg-green-100 text-green-700'
              : props.checklist.status === 'in-progress'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-600'
          }`}
        >
          {props.checklist.status}
        </span>
      </Show>
    </button>
  );
}

/**
 * Local checklist item
 */
function LocalChecklistItem(props) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/checklist/${props.checklist.id}`);
  };

  const formatDate = timestamp => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div
      class={`
        flex items-center group rounded-lg transition-colors
        ${props.isSelected ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}
      `}
    >
      <button
        onClick={handleClick}
        class='flex-1 flex items-center gap-2 px-3 py-2 text-left focus:outline-none min-w-0'
      >
        <HiOutlineDocumentCheck class='w-4 h-4 shrink-0 text-gray-500' />
        <div class='flex-1 min-w-0'>
          <div class='text-sm font-medium truncate'>{props.checklist.name}</div>
          <div class='text-2xs text-gray-500 mt-0.5'>
            {formatDate(props.checklist.updatedAt || props.checklist.createdAt)}
          </div>
        </div>
      </button>
      <button
        onClick={e => props.onDelete(e, props.checklist.id)}
        class='p-1.5 mr-1 rounded transition-colors text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100'
        aria-label='Delete checklist'
      >
        <BiRegularTrash class='w-4 h-4' />
      </button>
    </div>
  );
}
