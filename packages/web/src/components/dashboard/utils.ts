/**
 * Shared utilities for dashboard components
 */

export function formatRelativeTime(date: Date | string | number | undefined): string {
  if (!date) return '';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
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

function hashToColorIndex(id: string): number {
  if (!id) return 0;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % ACCENT_COLORS.length;
}

export function getAccentColors(id: string) {
  return ACCENT_COLORS[hashToColorIndex(id)];
}
