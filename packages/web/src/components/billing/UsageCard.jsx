/**
 * UsageCard Component
 * Displays quota usage with progress bars for the current subscription
 */

import { Show, For } from 'solid-js';
import { Progress } from '@corates/ui';
import { FiUsers, FiFolder, FiTrendingUp } from 'solid-icons/fi';

/**
 * Individual usage metric display
 * @param {Object} props
 * @param {string} props.label - Metric label
 * @param {number} props.used - Current usage
 * @param {number} props.max - Maximum allowed (-1 for unlimited)
 * @param {Function} props.icon - Icon component
 */
function UsageMetric(props) {
  const isUnlimited = () => props.max === -1;
  const percentage = () => {
    if (isUnlimited()) return 0;
    if (props.max === 0) return 0;
    return Math.min(100, Math.round((props.used / props.max) * 100));
  };

  const variant = () => {
    const pct = percentage();
    if (pct >= 90) return 'error';
    if (pct >= 75) return 'warning';
    return 'default';
  };

  return (
    <div class='space-y-2'>
      <div class='flex items-center justify-between'>
        <div class='flex items-center gap-2'>
          <div class='flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100'>
            {props.icon}
          </div>
          <span class='text-sm font-medium text-gray-700'>{props.label}</span>
        </div>
        <span class='text-sm font-semibold text-gray-900'>
          <Show when={!isUnlimited()} fallback={<span class='text-green-600'>Unlimited</span>}>
            {props.used} / {props.max}
          </Show>
        </span>
      </div>
      <Show when={!isUnlimited()}>
        <Progress value={percentage()} variant={variant()} />
      </Show>
      <Show when={isUnlimited()}>
        <div class='h-2 w-full rounded-full bg-linear-to-r from-green-100 to-green-200' />
      </Show>
    </div>
  );
}

/**
 * Usage card showing quota consumption
 * @param {Object} props
 * @param {Object} props.quotas - Current quotas from subscription
 * @param {Object} props.usage - Current usage counts
 */
export default function UsageCard(props) {
  const metrics = () => [
    {
      key: 'projects',
      label: 'Projects',
      icon: <FiFolder class='h-4 w-4 text-gray-600' />,
      used: props.usage?.projects ?? 0,
      max: props.quotas?.['projects.max'] ?? 0,
    },
    {
      key: 'collaborators',
      label: 'Team Members',
      icon: <FiUsers class='h-4 w-4 text-gray-600' />,
      used: props.usage?.collaborators ?? 0,
      max: props.quotas?.['collaborators.org.max'] ?? 0,
    },
  ];

  const hasAnyQuota = () => {
    const q = props.quotas;
    if (!q) return false;
    return q['projects.max'] !== 0 || q['collaborators.org.max'] !== 0;
  };

  return (
    <div class='rounded-xl border border-gray-200 bg-white p-6 shadow-sm'>
      <div class='mb-5 flex items-center gap-2'>
        <FiTrendingUp class='h-5 w-5 text-gray-400' />
        <h3 class='text-lg font-semibold text-gray-900'>Usage</h3>
      </div>

      <Show
        when={hasAnyQuota()}
        fallback={
          <div class='py-6 text-center'>
            <p class='text-sm text-gray-500'>
              Upgrade to a paid plan to create projects and collaborate with your team.
            </p>
          </div>
        }
      >
        <div class='space-y-5'>
          <For each={metrics()}>
            {metric => (
              <Show when={metric.max !== 0 || metric.used > 0}>
                <UsageMetric
                  label={metric.label}
                  icon={metric.icon}
                  used={metric.used}
                  max={metric.max}
                />
              </Show>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
