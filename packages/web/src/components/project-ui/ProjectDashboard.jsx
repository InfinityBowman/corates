import { createEffect, createSignal, onCleanup, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import useNotifications from '@primitives/useNotifications.js';
import projectStore from '@/stores/projectStore.js';
import { useConfirmDialog } from '@corates/ui';
import useProjectMemberHandlers from '@primitives/useProjectMemberHandlers.js';
import { useBetterAuth } from '@api/better-auth-store.js';
import CreateProjectForm from './CreateProjectForm.jsx';
import ProjectCard from './ProjectCard.jsx';
import { getRestoreParamsFromUrl } from '@lib/formStatePersistence.js';

export default function ProjectDashboard(props) {
  const navigate = useNavigate();

  // Check if we're returning from OAuth with state to restore
  const restoreParams = getRestoreParamsFromUrl();
  const shouldRestoreCreateProject = restoreParams?.type === 'createProject';

  const [showCreateForm, setShowCreateForm] = createSignal(shouldRestoreCreateProject);
  const { isOnline } = useBetterAuth();

  const userId = () => props.userId;

  // Read from store
  const projects = () => projectStore.getProjectList();
  const isLoading = () => projectStore.isProjectListLoading();
  const isLoaded = () => projectStore.isProjectListLoaded();
  const error = () => projectStore.getProjectListError();

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
    onNotification: notification => {
      if (notification.type === 'project-invite') {
        // Refresh to get the new project
        projectStore.refreshProjectList(userId());
      }
    },
  });

  // Connect to notifications when component mounts
  createEffect(() => {
    if (userId()) {
      connect();
    }
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

  // Confirm dialog and handlers for delete
  const confirmDialog = useConfirmDialog();
  const { handleDeleteProject } = useProjectMemberHandlers(null, confirmDialog);

  return (
    <div class='space-y-6'>
      {/* Header */}
      <div class='flex justify-between items-center'>
        <div>
          <h1 class='text-2xl font-bold text-gray-900'>My Projects</h1>
          <p class='text-gray-500 mt-1'>Manage your research projects</p>
        </div>
        <button
          class='inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transform hover:scale-[1.02] transition-all duration-200 shadow-md hover:shadow-lg gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
          onClick={() => setShowCreateForm(!showCreateForm())}
          disabled={!isOnline()}
          title={!isOnline() ? 'Cannot create projects while offline' : ''}
        >
          <span class='text-lg'>+</span>
          New Project
        </button>
      </div>

      {/* Error display */}
      <Show when={error() && !isOfflineError()}>
        <div class='bg-red-50 border border-red-200 rounded-lg p-4 text-red-700'>
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
              <div class='col-span-full text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300'>
                <div class='text-gray-500 mb-4'>No projects yet</div>
                <button
                  onClick={() => setShowCreateForm(true)}
                  class='text-blue-600 hover:text-blue-700 font-medium'
                >
                  Create your first project
                </button>
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
          <div class='col-span-full text-center py-12'>
            <div class='text-gray-400'>Loading projects...</div>
          </div>
        </Show>
      </div>

      {/* Confirm dialog */}
      <confirmDialog.ConfirmDialogComponent />
    </div>
  );
}
