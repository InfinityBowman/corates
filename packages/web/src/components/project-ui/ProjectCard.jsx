import { Show } from 'solid-js';

/**
 * Format a date value that could be an ISO string, Unix timestamp, or Date object
 * @param {string|number|Date} value - The date value to format
 * @returns {string} Formatted date string
 */
function formatDate(value) {
  if (!value) return '';

  let date;
  if (typeof value === 'string') {
    // ISO string from JSON serialization
    date = new Date(value);
  } else if (typeof value === 'number') {
    // Unix timestamp - check if seconds or milliseconds
    date = value > 1e12 ? new Date(value) : new Date(value * 1000);
  } else if (value instanceof Date) {
    date = value;
  } else {
    return '';
  }

  return isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

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
        <span>{formatDate(project().createdAt)}</span>
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
