import { createEffect, createSignal, onCleanup, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import useNotifications from '@primitives/useNotifications.js';
import { cleanupProjectLocalData } from '@primitives/useProject/index.js';
import projectStore from '@/stores/projectStore.js';
import projectActionsStore from '@/stores/projectActionsStore';
import { useConfirmDialog, showToast } from '@corates/ui';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useSubscription } from '@primitives/useSubscription.js';
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

  // Read from store
  const projects = () => projectStore.getProjectList();
  const projectCount = () => projects()?.length || 0;
  const isLoading = () => projectStore.isProjectListLoading();
  const isLoaded = () => projectStore.isProjectListLoaded();
  const error = () => projectStore.getProjectListError();

  // Check both entitlement and quota
  const canCreateProject = () => {
    return (
      hasEntitlement('project.create') &&
      hasQuota('projects.max', { used: projectCount(), requested: 1 })
    );
  };

  // Determine restriction type and quota limit for ContactPrompt
  const restrictionType = () => {
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

  // Fetch on mount if not already loaded
  createEffect(() => {
    if (userId()) {
      projectStore.fetchProjectList(userId());
    }
  });

  // Connect to notifications for real-time project updates
  const { connect, disconnect } = useNotifications(userId(), {
    onNotification: async notification => {
      if (notification.type === 'project-invite') {
        // Refresh to get the new project
        projectStore.refreshProjectList(userId());
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
    projectStore.addProjectToList(newProject);
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
            disabled={!isOnline() || subscriptionLoading()}
            title={!isOnline() ? 'Cannot create projects while offline' : ''}
          >
            <span class='text-lg'>+</span>
            New Project
          </button>
        </Show>
      </div>

      {/* Error display */}
      <Show when={error() && !isOfflineError()}>
        <div class='rounded-lg border border-red-200 bg-red-50 p-4 text-red-700'>
          {error()}
          <button onClick={() => projectStore.refreshProjectList(userId())} class='ml-2 underline'>
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
                <div class='mb-4 text-gray-500'>No projects yet</div>
                <Show
                  when={canCreateProject()}
                  fallback={
                    <div class='mx-auto max-w-md'>
                      <ContactPrompt
                        restrictionType={restrictionType()}
                        projectCount={projectCount()}
                        quotaLimit={quotaLimit()}
                      />
                    </div>
                  }
                >
                  <button
                    onClick={() => setShowCreateForm(true)}
                    class='font-medium text-blue-600 hover:text-blue-700'
                  >
                    Create your first project
                  </button>
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
