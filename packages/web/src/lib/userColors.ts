/**
 * User color utilities for presence indicators
 * Generates stable, distinguishable colors for user identification
 */

export interface PresenceColor {
  name: string;
  ring: string;
  bg: string;
  text: string;
  hex: string;
}

// Color palette optimized for presence indicators
// Uses colors that work well as rings, cursors, and avatars
export const PRESENCE_COLORS: PresenceColor[] = [
  { name: 'blue', ring: 'ring-blue-400', bg: 'bg-blue-500', text: 'text-blue-500', hex: '#3b82f6' },
  {
    name: 'emerald',
    ring: 'ring-emerald-400',
    bg: 'bg-emerald-500',
    text: 'text-emerald-500',
    hex: '#10b981',
  },
  {
    name: 'amber',
    ring: 'ring-amber-400',
    bg: 'bg-amber-500',
    text: 'text-amber-500',
    hex: '#f59e0b',
  },
  { name: 'pink', ring: 'ring-pink-400', bg: 'bg-pink-500', text: 'text-pink-500', hex: '#ec4899' },
  {
    name: 'indigo',
    ring: 'ring-indigo-400',
    bg: 'bg-indigo-500',
    text: 'text-indigo-500',
    hex: '#6366f1',
  },
  { name: 'cyan', ring: 'ring-cyan-400', bg: 'bg-cyan-500', text: 'text-cyan-500', hex: '#06b6d4' },
  {
    name: 'orange',
    ring: 'ring-orange-400',
    bg: 'bg-orange-500',
    text: 'text-orange-500',
    hex: '#f97316',
  },
  {
    name: 'violet',
    ring: 'ring-violet-400',
    bg: 'bg-violet-500',
    text: 'text-violet-500',
    hex: '#8b5cf6',
  },
];

/**
 * Simple hash function (DJB2) for stable color assignment
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Get a stable color for a user based on their ID
 */
export function getUserColor(userId: string | null | undefined): PresenceColor {
  if (!userId) return PRESENCE_COLORS[0];
  const index = hashString(userId) % PRESENCE_COLORS.length;
  return PRESENCE_COLORS[index];
}

/**
 * Get just the hex color for a user (for inline styles)
 */
export function getUserHexColor(userId: string | null | undefined): string {
  return getUserColor(userId).hex;
}
