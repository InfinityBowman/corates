import { createEffect, createSignal, onCleanup, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import useNotifications from '@primitives/useNotifications.js';
import { cleanupProjectLocalData } from '@primitives/useProject/index.js';
import projectStore from '@/stores/projectStore.js';
import projectActionsStore from '@/stores/projectActionsStore';
import { useConfirmDialog, showToast } from '@corates/ui';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useSubscription } from '@primitives/useSubscription.js';
import { useProjectList } from '@primitives/useProjectList.js';
import { useQueryClient } from '@tanstack/solid-query';
import { queryKeys } from '@lib/queryKeys.js';
import { isUnlimitedQuota } from '@corates/shared/plans';
import CreateProjectForm from './CreateProjectForm.jsx';
import ProjectCard from './ProjectCard.jsx';
import ContactPrompt from './ContactPrompt.jsx';
import { getRestoreParamsFromUrl } from '@lib/formStatePersistence.js';

export default function ProjectDashboard(props) {
  const navigate = useNavigate();
  const confirmDialog = useConfirmDialog();

  // Check if we're returning from OAuth with state to restore
  const restoreParams = getRestoreParamsFromUrl();
  const shouldRestoreCreateProject = restoreParams?.type === 'createProject';

  const [showCreateForm, setShowCreateForm] = createSignal(shouldRestoreCreateProject);
  const { isOnline } = useBetterAuth();
  const { hasEntitlement, hasQuota, quotas, loading: subscriptionLoading } = useSubscription();

  const userId = () => props.userId;
  const queryClient = useQueryClient();

  // Use TanStack Query for project list
  const projectListQuery = useProjectList(userId);
  const projects = () => projectListQuery.projects();
  const projectCount = () => projects()?.length || 0;
  const isLoading = () => projectListQuery.isLoading();
  // isLoaded is true when we have successfully fetched data (not just when not loading)
  const isLoaded = () => projectListQuery.query.isSuccess;
  const error = () => projectListQuery.error();

  // Check both entitlement and quota
  // Return null while loading to avoid UI flicker (neither show button nor ContactPrompt)
  const canCreateProject = () => {
    // While loading, return null to indicate indeterminate state
    if (subscriptionLoading()) return null;
    return (
      hasEntitlement('project.create') &&
      hasQuota('projects.max', { used: projectCount(), requested: 1 })
    );
  };

  // Determine restriction type and quota limit for ContactPrompt
  // Only show ContactPrompt if subscription has loaded and user doesn't have entitlement
  const restrictionType = () => {
    // Don't show prompt while loading (prevents showing default 'free' tier data)
    if (subscriptionLoading()) return null;
    return !hasEntitlement('project.create') ? 'entitlement' : 'quota';
  };

  const quotaLimit = () => {
    const limit = quotas()['projects.max'];
    return isUnlimitedQuota(limit) ? -1 : limit;
  };

  // Check if error is due to offline state
  const isOfflineError = () => {
    const err = error();
    return err && (err.includes('No internet connection') || err.includes('connection error'));
  };

  // Project list is automatically fetched by useProjectList hook

  // Connect to notifications for real-time project updates
  const { connect, disconnect } = useNotifications(userId(), {
    onNotification: async notification => {
      if (notification.type === 'project-invite') {
        // Invalidate project list query to refetch
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(userId()) });
      } else if (notification.type === 'removed-from-project') {
        // Clean up local data for the project we were removed from
        await cleanupProjectLocalData(notification.projectId);
        showToast.info(
          'Removed from Project',
          `You were removed from "${notification.projectName}"`,
        );
      } else if (notification.type === 'project-deleted') {
        // Clean up local data for the deleted project
        await cleanupProjectLocalData(notification.projectId);
        showToast.info('Project Deleted', `"${notification.projectName}" was deleted`);
      }
    },
  });

  // Connect to notifications when component mounts
  createEffect(() => {
    const currentUserId = userId();
    if (!currentUserId) {
      // Disconnect if userId becomes null (e.g., during signout)
      disconnect();
      return;
    }
    connect();
  });

  onCleanup(() => {
    disconnect();
  });

  const handleProjectCreated = (
    newProject,
    pendingPdfs = [],
    pendingRefs = [],
    driveFiles = [],
  ) => {
    // Invalidate project list query to refetch with new project
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(userId()) });
    // Store non-serializable data in projectStore instead of router state
    if (pendingPdfs.length > 0 || pendingRefs.length > 0 || driveFiles.length > 0) {
      projectStore.setPendingProjectData(newProject.id, { pendingPdfs, pendingRefs, driveFiles });
    }
    setShowCreateForm(false);
    navigate(`/projects/${newProject.id}`);
  };

  const openProject = projectId => {
    navigate(`/projects/${projectId}`);
  };

  // Handler for deleting projects from dashboard
  const handleDeleteProject = async targetProjectId => {
    const confirmed = await confirmDialog.open({
      title: 'Delete Project',
      description:
        'Are you sure you want to delete this entire project? This action cannot be undone.',
      confirmText: 'Delete Project',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      // Use deleteById since we're outside the project view (no active project set)
      await projectActionsStore.project.deleteById(targetProjectId);
      showToast.success('Project Deleted', 'The project has been deleted successfully');
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, {
        toastTitle: 'Delete Failed',
      });
    }
  };

  return (
    <div class='space-y-6'>
      {/* Header */}
      <div class='flex flex-wrap items-center justify-between gap-4'>
        <div>
          <h1 class='text-2xl font-bold text-gray-900'>My Projects</h1>
          <p class='mt-1 text-gray-500'>Manage your research projects</p>
        </div>
        {/* Show loading skeleton while subscription loads, then show button or ContactPrompt */}
        <Show
          when={canCreateProject() !== null}
          fallback={<div class='h-10 w-32 animate-pulse rounded-lg bg-gray-200' />}
        >
          <Show
            when={canCreateProject()}
            fallback={
              <div class='max-w-sm'>
                <ContactPrompt
                  restrictionType={restrictionType()}
                  projectCount={projectCount()}
                  quotaLimit={quotaLimit()}
                />
              </div>
            }
          >
            <button
              class='inline-flex transform items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-md transition-all duration-200 hover:scale-[1.02] hover:bg-blue-700 hover:shadow-lg focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100'
              onClick={() => setShowCreateForm(!showCreateForm())}
              disabled={!isOnline()}
              title={!isOnline() ? 'Cannot create projects while offline' : ''}
            >
              <span class='text-lg'>+</span>
              New Project
            </button>
          </Show>
        </Show>
      </div>

      {/* Error display */}
      <Show when={error() && !isOfflineError()}>
        <div class='rounded-lg border border-red-200 bg-red-50 p-4 text-red-700'>
          {error()?.message || 'An error occurred'}
          <button onClick={() => projectListQuery.refetch()} class='ml-2 underline'>
            Retry
          </button>
        </div>
      </Show>

      {/* Create Project Form */}
      <Show when={showCreateForm()}>
        <CreateProjectForm
          apiBase={props.apiBase}
          onProjectCreated={handleProjectCreated}
          onCancel={() => setShowCreateForm(false)}
        />
      </Show>

      {/* Projects Grid */}
      <div class='grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
        <Show
          when={projects()?.length > 0}
          fallback={
            <Show when={!isLoading()}>
              <div class='col-span-full rounded-lg border-2 border-dashed border-gray-300 bg-white px-6 py-12'>
                <div class='text-center text-gray-500'>No projects yet</div>
                <Show when={canCreateProject()}>
                  <div class='flex justify-center'>
                    <button
                      onClick={() => setShowCreateForm(true)}
                      class='mt-4 font-medium text-blue-600 hover:text-blue-700'
                    >
                      Create your first project
                    </button>
                  </div>
                </Show>
              </div>
            </Show>
          }
        >
          <For each={projects()}>
            {project => (
              <ProjectCard project={project} onOpen={openProject} onDelete={handleDeleteProject} />
            )}
          </For>
        </Show>

        {/* Loading state */}
        <Show when={isLoading() && !isLoaded()}>
          <div class='col-span-full py-12 text-center'>
            <div class='text-gray-400'>Loading projects...</div>
          </div>
        </Show>
      </div>

      <confirmDialog.ConfirmDialogComponent />
    </div>
  );
}
