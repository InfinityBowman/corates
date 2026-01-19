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

/**
 * Stats Card component for admin dashboard
 * Displays a single statistic with icon and optional loading state
 * @param {object} props - Component props
 * @param {string} props.title - The title of the stat
 * @param {number|string} props.value - The value of the stat
 * @param {'blue'|'green'|'purple'|'orange'} props.color - The color theme of the stat
 * @param {Component} props.icon - The icon component to display
 * @param {boolean} [props.loading] - Whether the stat is loading
 * @returns {JSX.Element} - The StatsCard component
 */
export default function StatsCard(props) {
  const title = () => props.title;
  const value = () => props.value;
  const loading = () => props.loading;
  const colors = () => colorMap[props.color] || colorMap.blue;

  return (
    <div class={`border-border rounded-lg border p-5 ${colors().bg}`}>
      <div class='flex items-center justify-between'>
        <div>
          <p class='text-muted-foreground text-sm font-medium'>{title()}</p>
          <Show
            when={!loading()}
            fallback={<div class='bg-secondary mt-1 h-8 w-16 animate-pulse rounded' />}
          >
            <p class={`mt-1 text-2xl font-bold ${colors().text}`}>{value()}</p>
          </Show>
        </div>
        <div class={`rounded-lg p-3 ${colors().icon}`}>
          <props.icon class='h-6 w-6' />
        </div>
      </div>
    </div>
  );
}
