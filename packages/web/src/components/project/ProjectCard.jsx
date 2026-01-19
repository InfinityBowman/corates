import { Show } from 'solid-js';
import { FiTrash2 } from 'solid-icons/fi';

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
    <div class='group border-border bg-card hover:border-border-strong flex h-full flex-col rounded-lg border p-6 shadow-sm transition-all duration-200 hover:shadow-md'>
      {/* Header section with fixed structure */}
      <div class='min-h-0 flex-1'>
        <h3 class='text-foreground mb-1 line-clamp-2 text-lg font-semibold'>{project().name}</h3>
        <p class='text-muted-foreground line-clamp-2 min-h-10 text-sm'>
          {project().description || 'No description'}
        </p>
      </div>

      {/* Metadata row */}
      <div class='text-muted-foreground mt-3 mb-3 flex items-center justify-between text-xs'>
        <span class='inline-flex items-center rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-800 capitalize'>
          {project().role}
        </span>
        <span>{formatDate(project().createdAt)}</span>
      </div>

      {/* Action buttons */}
      <div class='flex gap-2'>
        <button
          onClick={() => props.onOpen?.(project().id)}
          class='bg-primary hover:bg-primary/90 focus:ring-primary flex-1 rounded-lg px-4 py-2 font-medium text-white transition-colors focus:ring-2 focus:outline-none'
        >
          Open Project
        </button>
        <Show when={project().role === 'owner'}>
          <button
            onClick={e => {
              e.stopPropagation();
              props.onDelete?.(project().id);
            }}
            class='text-muted-foreground/70 focus:ring-primary rounded-lg p-2 transition-colors hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:outline-none'
            title='Delete Project'
          >
            <FiTrash2 class='h-5 w-5' />
          </button>
        </Show>
      </div>
    </div>
  );
}
