/**
 * Stats Card component for admin dashboard
 */

import { Show } from 'solid-js';

const colorMap = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'bg-blue-100 text-blue-600',
    text: 'text-blue-600',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'bg-green-100 text-green-600',
    text: 'text-green-600',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'bg-purple-100 text-purple-600',
    text: 'text-purple-600',
  },
  orange: {
    bg: 'bg-orange-50',
    icon: 'bg-orange-100 text-orange-600',
    text: 'text-orange-600',
  },
};

export default function StatsCard(props) {
  const colors = () => colorMap[props.color] || colorMap.blue;

  return (
    <div class={`rounded-lg border border-gray-200 p-5 ${colors().bg}`}>
      <div class='flex items-center justify-between'>
        <div>
          <p class='text-sm font-medium text-gray-600'>{props.title}</p>
          <Show
            when={!props.loading}
            fallback={<div class='mt-1 h-8 w-16 animate-pulse rounded bg-gray-200' />}
          >
            <p class={`mt-1 text-2xl font-bold ${colors().text}`}>{props.value}</p>
          </Show>
        </div>
        <div class={`rounded-lg p-3 ${colors().icon}`}>
          <props.icon class='h-6 w-6' />
        </div>
      </div>
    </div>
  );
}
