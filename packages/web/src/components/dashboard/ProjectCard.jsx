/**
 * ProjectCard - Enhanced project card with accent colors and progress bar
 *
 * Features:
 * - Deterministic accent color based on project ID
 * - Progress bar with gradient
 * - Role badge (Lead/Reviewer)
 * - Member count
 * - Relative timestamp
 * - Hover effects and animations
 */

import { Show, createMemo } from 'solid-js';
import { FiUsers, FiChevronRight, FiTrash2 } from 'solid-icons/fi';

/**
 * Accent color configurations
 */
const ACCENT_COLORS = [
  {
    name: 'blue',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    fill: 'bg-blue-500',
    gradient: 'from-blue-500 to-blue-600',
  },
  {
    name: 'amber',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    fill: 'bg-amber-500',
    gradient: 'from-amber-400 to-orange-500',
  },
  {
    name: 'rose',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    fill: 'bg-rose-500',
    gradient: 'from-rose-400 to-pink-500',
  },
  {
    name: 'emerald',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    fill: 'bg-emerald-500',
    gradient: 'from-emerald-400 to-teal-500',
  },
  {
    name: 'violet',
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    fill: 'bg-violet-500',
    gradient: 'from-violet-400 to-purple-500',
  },
];

/**
 * Generate a deterministic color index from a string (project ID)
 * @param {string} id - Project ID
 * @returns {number} - Color index
 */
function hashToColorIndex(id) {
  if (!id) return 0;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % ACCENT_COLORS.length;
}

/**
 * Format a relative time string
 * @param {Date|string|number} date
 * @returns {string}
 */
function formatRelativeTime(date) {
  if (!date) return '';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return then.toLocaleDateString();
}

/**
 * Enhanced project card component
 * @param {Object} props
 * @param {Object} props.project - Project data
 * @param {() => void} props.onOpen - Called when project is opened
 * @param {() => void} [props.onDelete] - Called when delete is requested
 * @param {Object} [props.style] - Animation style object
 */
export function ProjectCard(props) {
  const colors = createMemo(() => {
    const index = hashToColorIndex(props.project?.id);
    return ACCENT_COLORS[index];
  });

  const progress = createMemo(() => {
    const completed = props.project?.completedCount || 0;
    const total = props.project?.studyCount || 0;
    if (total === 0) return { completed: 0, total: 0, percentage: 0 };
    return {
      completed,
      total,
      percentage: Math.round((completed / total) * 100),
    };
  });

  const relativeTime = createMemo(() => {
    return formatRelativeTime(props.project?.updatedAt || props.project?.createdAt);
  });

  const memberCount = createMemo(() => {
    return props.project?.memberCount || props.project?.members?.length || 1;
  });

  const isOwner = () => props.project?.role === 'owner';

  return (
    <div
      class='group relative overflow-hidden rounded-2xl border border-stone-200/60 bg-white p-6 shadow-sm transition-all duration-300 hover:border-stone-300 hover:shadow-lg hover:shadow-stone-200/50'
      style={props.style}
    >
      {/* Decorative corner accent */}
      <div
        class={`absolute -top-10 -right-10 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-40 ${colors().fill}`}
      />

      {/* Header */}
      <div class='relative mb-4 flex items-start justify-between'>
        <div class='min-w-0 flex-1 pr-4'>
          <div class='mb-2 flex items-center gap-2'>
            <span
              class={`text-2xs inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium tracking-wide uppercase ${colors().bg} ${colors().text}`}
            >
              {isOwner() ? 'Lead' : 'Reviewer'}
            </span>
            <span class='text-xs text-stone-400'>{relativeTime()}</span>
          </div>
          <h3 class='line-clamp-2 text-lg leading-snug font-semibold text-stone-800 transition-colors group-hover:text-blue-600'>
            {props.project?.name}
          </h3>
        </div>

        {/* Delete button for owners */}
        <Show when={isOwner() && props.onDelete}>
          <button
            type='button'
            onClick={e => {
              e.stopPropagation();
              props.onDelete?.(props.project?.id);
            }}
            class='z-10 shrink-0 rounded-lg p-2 text-stone-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500'
            title='Delete Project'
          >
            <FiTrash2 class='h-4 w-4' />
          </button>
        </Show>
      </div>

      {/* Description */}
      <p class='mb-5 line-clamp-2 text-sm leading-relaxed text-stone-500'>
        {props.project?.description || 'No description'}
      </p>

      {/* Progress bar */}
      <div class='mb-4'>
        <div class='mb-1.5 flex items-center justify-between text-xs'>
          <span class='font-medium text-stone-600'>Progress</span>
          <span class='text-stone-500 tabular-nums'>
            {progress().completed}/{progress().total} studies
          </span>
        </div>
        <div class='h-1.5 overflow-hidden rounded-full bg-stone-100'>
          <div
            class={`h-full rounded-full bg-linear-to-r ${colors().gradient} transition-all duration-500`}
            style={{ width: `${progress().percentage}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div class='flex items-center justify-between'>
        <div class='flex items-center gap-1.5 text-xs text-stone-500'>
          <FiUsers class='h-3.5 w-3.5' />
          <span>
            {memberCount()} member{memberCount() !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          type='button'
          onClick={() => props.onOpen?.(props.project?.id)}
          class='flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 transition-all hover:bg-blue-50 hover:text-blue-700'
        >
          Open
          <FiChevronRight class='h-4 w-4 transition-transform group-hover:translate-x-0.5' />
        </button>
      </div>
    </div>
  );
}

export default ProjectCard;
