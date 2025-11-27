import { createSignal, createResource, createEffect, onCleanup, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import useNotifications from '@primitives/useNotifications.js';
import CreateProjectForm from './CreateProjectForm.jsx';
import ProjectCard from './ProjectCard.jsx';

export default function ProjectDashboard({ apiBase, userId }) {
  const navigate = useNavigate();
  const [showCreateForm, setShowCreateForm] = createSignal(false);

  // Fetch user's projects
  const [projects, { mutate: setProjects, refetch }] = createResource(async () => {
    try {
      const response = await fetch(`${apiBase}/api/users/${userId}/projects`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch projects');
      return await response.json();
    } catch (error) {
      console.error('Error fetching projects:', error);
      return [];
    }
  });

  // Connect to notifications for real-time project updates
  const { connect, disconnect } = useNotifications(userId, {
    onNotification: notification => {
      if (notification.type === 'project-invite') {
        refetch();
      }
    },
  });

  // Connect to notifications when component mounts
  createEffect(() => {
    if (userId) {
      connect();
    }
  });

  onCleanup(() => {
    disconnect();
  });

  const handleProjectCreated = newProject => {
    setProjects(prev => [...(prev || []), newProject]);
    setShowCreateForm(false);
    navigate(`/projects/${newProject.id}`);
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

      {/* Create Project Form */}
      <Show when={showCreateForm()}>
        <CreateProjectForm
          apiBase={apiBase}
          onProjectCreated={handleProjectCreated}
          onCancel={() => setShowCreateForm(false)}
        />
      </Show>

      {/* Projects Grid */}
      <div class='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <Show
          when={projects()?.length > 0}
          fallback={
            <Show when={!projects.loading}>
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
      </div>
    </div>
  );
}
