import { createSignal, createResource, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';

export default function ProjectDashboard({ apiBase, userId }) {
  const navigate = useNavigate();
  const [showCreateForm, setShowCreateForm] = createSignal(false);
  const [newProjectName, setNewProjectName] = createSignal('');
  const [newProjectDescription, setNewProjectDescription] = createSignal('');
  const [isCreating, setIsCreating] = createSignal(false);

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

  const createProject = async () => {
    if (!newProjectName().trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch(`${apiBase}/api/projects`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProjectName().trim(),
          description: newProjectDescription().trim(),
        }),
      });

      if (!response.ok) throw new Error('Failed to create project');

      const newProject = await response.json();

      // Add to existing projects list
      setProjects(prev => [...(prev || []), newProject]);

      // Reset form
      setNewProjectName('');
      setNewProjectDescription('');
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const openProject = projectId => {
    navigate(`/projects/${projectId}`);
  };

  return (
    <div class='space-y-6'>
      {/* Header */}
      <div class='flex justify-between items-center'>
        <div>
          <h1 class='text-2xl font-bold text-white'>My Projects</h1>
          <p class='text-gray-400 mt-1'>Manage your research projects and AMSTAR2 checklists</p>
        </div>
        <button
          class='bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2'
          onClick={() => setShowCreateForm(!showCreateForm())}
        >
          <span class='text-lg'>+</span>
          New Project
        </button>
      </div>

      {/* Create Project Form */}
      <Show when={showCreateForm()}>
        <div class='bg-gray-800 p-6 rounded-lg border border-gray-700'>
          <h3 class='text-lg font-semibold text-white mb-4'>Create New Project</h3>

          <div class='space-y-4'>
            <div>
              <label class='block text-sm font-medium text-gray-300 mb-2'>Project Name</label>
              <input
                type='text'
                placeholder='e.g., Sleep Study Meta-Analysis'
                value={newProjectName()}
                onInput={e => setNewProjectName(e.target.value)}
                class='w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500'
              />
            </div>

            <div>
              <label class='block text-sm font-medium text-gray-300 mb-2'>
                Description (Optional)
              </label>
              <textarea
                placeholder='Brief description of your research project...'
                value={newProjectDescription()}
                onInput={e => setNewProjectDescription(e.target.value)}
                rows='3'
                class='w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500'
              />
            </div>
          </div>

          <div class='flex gap-3 mt-6'>
            <button
              onClick={createProject}
              disabled={isCreating() || !newProjectName().trim()}
              class='bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors'
            >
              {isCreating() ? 'Creating...' : 'Create Project'}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              class='bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors'
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>

      {/* Projects Grid */}
      <div class='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <Show
          when={!projects.loading}
          fallback={
            <div class='col-span-full text-center py-8'>
              <div class='text-gray-400'>Loading projects...</div>
            </div>
          }
        >
          <Show
            when={projects() && projects().length > 0}
            fallback={
              <div class='col-span-full text-center py-12'>
                <div class='text-gray-400 mb-4'>No projects yet</div>
                <button
                  onClick={() => setShowCreateForm(true)}
                  class='text-blue-400 hover:text-blue-300 underline'
                >
                  Create your first project
                </button>
              </div>
            }
          >
            <For each={projects()}>
              {project => (
                <div class='bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition-colors'>
                  <div class='mb-4'>
                    <h3 class='text-lg font-semibold text-white mb-2'>{project.name}</h3>
                    <Show when={project.description}>
                      <p class='text-gray-400 text-sm line-clamp-3'>{project.description}</p>
                    </Show>
                  </div>

                  <div class='flex items-center justify-between text-xs text-gray-500 mb-4'>
                    <span class='bg-gray-700 px-2 py-1 rounded capitalize'>{project.role}</span>
                    <span>{new Date(project.createdAt * 1000).toLocaleDateString()}</span>
                  </div>

                  <button
                    onClick={() => openProject(project.id)}
                    class='w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors'
                  >
                    Open Project
                  </button>
                </div>
              )}
            </For>
          </Show>
        </Show>
      </div>
    </div>
  );
}
