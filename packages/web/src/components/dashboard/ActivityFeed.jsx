/**
 * ActivityFeed - Shows recent activity across projects
 */

import { Show, For, createMemo, useContext } from 'solid-js';
import { FiClock, FiFileText, FiFolder, FiCheck, FiUser } from 'solid-icons/fi';

import { AnimationContext } from './Dashboard.jsx';

/**
 * Format a relative time string
 * @param {Date|string} date
 * @returns {string}
 */
function formatRelativeTime(date) {
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
  return then.toLocaleDateString();
}

/**
 * Icon for activity type
 */
function ActivityIcon(props) {
  const iconMap = {
    study: <FiFileText class='h-4 w-4' />,
    project: <FiFolder class='h-4 w-4' />,
    complete: <FiCheck class='h-4 w-4' />,
    user: <FiUser class='h-4 w-4' />,
    default: <FiClock class='h-4 w-4' />,
  };

  const bgMap = {
    study: 'bg-blue-100 text-primary',
    project: 'bg-amber-100 text-amber-600',
    complete: 'bg-emerald-100 text-emerald-600',
    user: 'bg-violet-100 text-violet-600',
    default: 'bg-secondary text-secondary-foreground',
  };

  return (
    <div
      class={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bgMap[props.type] || bgMap.default}`}
    >
      {iconMap[props.type] || iconMap.default}
    </div>
  );
}

/**
 * Single activity item
 */
function ActivityItem(props) {
  return (
    <div class='flex items-start gap-3 py-3'>
      <ActivityIcon type={props.activity.type} />
      <div class='min-w-0 flex-1'>
        <p class='text-secondary-foreground text-sm'>
          <span class='font-medium'>{props.activity.title}</span>
          <Show when={props.activity.subtitle}>
            <span class='text-muted-foreground'> {props.activity.subtitle}</span>
          </Show>
        </p>
        <p class='text-muted-foreground/70 mt-0.5 text-xs'>
          {formatRelativeTime(props.activity.timestamp)}
        </p>
      </div>
    </div>
  );
}

/**
 * Empty state for no activity
 */
function EmptyActivity() {
  return (
    <div class='py-8 text-center'>
      <div class='bg-secondary mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full'>
        <FiClock class='text-muted-foreground/70 h-5 w-5' />
      </div>
      <p class='text-muted-foreground text-sm'>No recent activity</p>
      <p class='text-muted-foreground/70 mt-1 text-xs'>
        Your activity will appear here as you work
      </p>
    </div>
  );
}

/**
 * Activity feed component
 * @param {Object} props
 * @param {Array} props.activities - Array of activity objects
 * @param {number} [props.limit] - Maximum number of activities to show
 * @param {() => void} [props.onViewAll] - Handler for view all link
 */
export function ActivityFeed(props) {
  const animation = useContext(AnimationContext);

  const displayActivities = createMemo(() => {
    const activities = props.activities || [];
    const limit = props.limit || 5;
    return activities.slice(0, limit);
  });

  return (
    <div class='border-border/60 bg-card rounded-xl border p-5' style={animation.fadeUp(500)}>
      <div class='mb-2 flex items-center justify-between'>
        <h3 class='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
          Recent Activity
        </h3>
        <Show when={props.onViewAll && props.activities?.length > (props.limit || 5)}>
          <button
            type='button'
            onClick={() => props.onViewAll?.()}
            class='text-primary hover:text-primary/80 text-xs font-medium'
          >
            View all
          </button>
        </Show>
      </div>

      <Show when={displayActivities().length > 0} fallback={<EmptyActivity />}>
        <div class='divide-border-subtle divide-y'>
          <For each={displayActivities()}>{activity => <ActivityItem activity={activity} />}</For>
        </div>
      </Show>
    </div>
  );
}

export default ActivityFeed;
