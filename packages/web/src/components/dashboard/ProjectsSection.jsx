/**
 * ProjectsSection - Projects grid for dashboard
 *
 * Displays projects with the enhanced ProjectCard design,
 * handles create form, empty states, and loading states.
 */

import { Show, For, useContext } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useQueryClient } from '@tanstack/solid-query';
import { useConfirmDialog, showToast } from '@corates/ui';
import { FiPlus, FiFolder } from 'solid-icons/fi';

import { AnimationContext } from './Dashboard.jsx';

import { useMyProjectsList } from '@primitives/useMyProjectsList.js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useSubscription } from '@primitives/useSubscription.js';
import { API_BASE } from '@config/api.js';
import { queryKeys } from '@lib/queryKeys.js';
import projectStore from '@/stores/projectStore.js';

import { ProjectCard } from './ProjectCard.jsx';
import CreateProjectForm from '@/components/project/CreateProjectForm.jsx';
import ContactPrompt from '@/components/project/ContactPrompt.jsx';

/**
 * Empty state when no projects exist
 */
function EmptyProjectsState(props) {
  return (
    <div class='col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/50 px-6 py-16'>
      <div class='mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100'>
        <FiFolder class='h-8 w-8 text-stone-400' />
      </div>
      <h3 class='mb-2 text-lg font-semibold text-stone-700'>No projects yet</h3>
      <p class='mb-6 max-w-sm text-center text-sm text-stone-500'>
        Create your first project to start collaborating on evidence synthesis with your team.
      </p>
      <Show when={props.canCreate}>
        <button
          type='button'
          onClick={() => props.onCreateClick?.()}
          disabled={!props.isOnline}
          class='flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50'
        >
          <FiPlus class='h-4 w-4' />
          Create First Project
        </button>
      </Show>
    </div>
  );
}

/**
 * Projects section component
 * @param {Object} props
 * @param {boolean} [props.showHeader] - Whether to show section header
 * @param {() => void} [props.onCreateClick] - External handler for create button
 */
export function ProjectsSection(props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirmDialog = useConfirmDialog();
  const { isOnline } = useBetterAuth();

  // Projects data
  const projectListQuery = useMyProjectsList();
  const projects = () => projectListQuery.projects();
  const projectCount = () => projects()?.length || 0;

  // Subscription checks
  const { hasEntitlement, hasQuota, quotas, loading: subscriptionLoading } = useSubscription();

  const showCreateForm = () => props.showCreateForm();
  const setShowCreateForm = val => props.setShowCreateForm(val);

  // Local-first: assume user can create unless we definitively know they can't
  // Don't block UI on subscription loading - optimistically allow action
  const canCreateProject = () => {
    // If still loading subscription data, assume they can create
    if (subscriptionLoading()) return true;
    return (
      hasEntitlement('project.create') &&
      hasQuota('projects.max', { used: projectCount(), requested: 1 })
    );
  };

  const restrictionType = () => {
    // Don't show restriction prompts while loading
    if (subscriptionLoading()) return null;
    return !hasEntitlement('project.create') ? 'entitlement' : 'quota';
  };

  // Handlers
  const handleProjectCreated = (
    newProject,
    pendingPdfs = [],
    pendingRefs = [],
    driveFiles = [],
  ) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });

    if (pendingPdfs.length > 0 || pendingRefs.length > 0 || driveFiles.length > 0) {
      projectStore.setPendingProjectData(newProject.id, { pendingPdfs, pendingRefs, driveFiles });
    }

    setShowCreateForm(false);
    navigate(`/projects/${newProject.id}`);
  };

  const openProject = projectId => {
    navigate(`/projects/${projectId}`);
  };

  const handleDeleteProject = async targetProjectId => {
    const confirmed = await confirmDialog.open({
      title: 'Delete Project',
      description:
        'Are you sure you want to delete this entire project? This action cannot be undone.',
      confirmText: 'Delete Project',
      variant: 'danger',
    });
    if (!confirmed) return;

    const project = projects()?.find(p => p.id === targetProjectId);
    if (!project?.orgId) {
      showToast.error('Error', 'Unable to find project organization');
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/orgs/${project.orgId}/projects/${targetProjectId}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete project');
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      showToast.success('Project Deleted', 'The project has been deleted successfully');
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, { toastTitle: 'Delete Failed' });
    }
  };

  const hasProjects = () => projects()?.length > 0;

  const handleCreateClick = () => {
    if (props.onCreateClick) {
      props.onCreateClick();
    } else {
      setShowCreateForm(true);
    }
  };

  const animation = useContext(AnimationContext);

  return (
    <section style={animation.fadeUp(200)}>
      {/* Header */}
      <Show when={props.showHeader !== false}>
        <div class='mb-4 flex items-center justify-between'>
          <h2 class='text-sm font-semibold tracking-wide text-stone-500 uppercase'>
            Your Projects
          </h2>
          <Show
            when={canCreateProject() && hasProjects()}
            fallback={
              <Show when={!canCreateProject() && canCreateProject() !== null}>
                <ContactPrompt
                  restrictionType={restrictionType()}
                  projectCount={projectCount()}
                  quotaLimit={quotas()?.['projects.max']}
                  compact
                />
              </Show>
            }
          >
            <button
              type='button'
              onClick={handleCreateClick}
              disabled={!isOnline()}
              class='flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 transition-all hover:scale-105 hover:bg-blue-50 hover:shadow-sm active:scale-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100'
            >
              <FiPlus class='h-4 w-4' />
              New Project
            </button>
          </Show>
        </div>
      </Show>

      {/* Create form */}
      <Show when={showCreateForm()}>
        <div class='mb-6'>
          <CreateProjectForm
            apiBase={API_BASE}
            onProjectCreated={handleProjectCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      </Show>

      {/* Projects grid */}
      <div class='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
        {/* Empty state */}
        <Show when={!hasProjects()}>
          <EmptyProjectsState
            canCreate={canCreateProject()}
            isOnline={isOnline()}
            onCreateClick={handleCreateClick}
          />
        </Show>

        {/* Project cards */}
        <For each={projects()}>
          {(project, index) => (
            <ProjectCard
              project={project}
              onOpen={openProject}
              onDelete={handleDeleteProject}
              style={animation.statRise(index() * 50)}
            />
          )}
        </For>
      </div>

      <confirmDialog.ConfirmDialogComponent />
    </section>
  );
}

export default ProjectsSection;
