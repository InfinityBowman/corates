import { createEffect, createSignal, onCleanup, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import useNotifications from '@primitives/useNotifications.js';
import projectStore from '@primitives/projectStore.js';
import CreateProjectForm from './CreateProjectForm.jsx';
import ProjectCard from './ProjectCard.jsx';

export default function ProjectDashboard(props) {
  const navigate = useNavigate();
  const [showCreateForm, setShowCreateForm] = createSignal(false);

  const userId = () => props.userId;

  // Read from store
  const projects = () => projectStore.getProjectList();
  const isLoading = () => projectStore.isProjectListLoading();
  const isLoaded = () => projectStore.isProjectListLoaded();
  const error = () => projectStore.getProjectListError();

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

  const handleProjectCreated = (newProject, pendingPdfs = []) => {
    projectStore.addProjectToList(newProject);
    setShowCreateForm(false);
    navigate(`/projects/${newProject.id}`, { state: { pendingPdfs } });
  };

  const openProject = projectId => {
    navigate(`/projects/${projectId}`);
  };

  return (
    <div class='space-y-6'>
      {/* Header */}
      <div class='flex justify-between items-center'>
        <div>
          <h1 class='text-2xl font-bold text-gray-900'>My Projects</h1>
          <p class='text-gray-500 mt-1'>Manage your research projects and AMSTAR2 checklists</p>
        </div>
        <button
          class='inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transform hover:scale-[1.02] transition-all duration-200 shadow-md hover:shadow-lg gap-2'
          onClick={() => setShowCreateForm(!showCreateForm())}
        >
          <span class='text-lg'>+</span>
          New Project
        </button>
      </div>

      {/* Error display */}
      <Show when={error()}>
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
      <div class='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
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
            {project => <ProjectCard project={project} onOpen={openProject} />}
          </For>
        </Show>

        {/* Loading state */}
        <Show when={isLoading() && !isLoaded()}>
          <div class='col-span-full text-center py-12'>
            <div class='text-gray-400'>Loading projects...</div>
          </div>
        </Show>
      </div>
    </div>
  );
}
