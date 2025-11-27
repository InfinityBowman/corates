import { Show } from 'solid-js';

/**
 * Card component for displaying a project in the dashboard grid
 * @param {Object} props
 * @param {Object} props.project - Project data
 * @param {Function} props.onOpen - Called when project is opened
 */
export default function ProjectCard(props) {
  const project = () => props.project;

  return (
    <div class='bg-white border border-gray-200 rounded-lg shadow-sm p-6 hover:shadow-md hover:border-gray-300 transition-all duration-200 group'>
      <div class='mb-4'>
        <h3 class='text-lg font-semibold text-gray-900 mb-2'>{project().name}</h3>
        <Show when={project().description}>
          <p class='text-gray-500 text-sm line-clamp-3'>{project().description}</p>
        </Show>
      </div>

      <div class='flex items-center justify-between text-xs text-gray-500 mb-4'>
        <span class='inline-flex items-center px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-800 capitalize'>
          {project().role}
        </span>
        <span>{new Date(project().createdAt * 1000).toLocaleDateString()}</span>
      </div>

      <button
        onClick={() => props.onOpen?.(project().id)}
        class='w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors font-medium'
      >
        Open Project
      </button>
    </div>
  );
}
