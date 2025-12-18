import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names with Tailwind CSS conflict resolution.
 * Uses clsx for conditional classes and tailwind-merge for smart overrides.
 *
 * @example
 * cn('px-2 py-1', 'px-4')           // → 'py-1 px-4' (px-4 wins)
 * cn('p-4', props.class)            // → consumer can override padding
 * cn('text-sm', large && 'text-lg') // → conditional classes
 *
 * @param {...(string|object|array|boolean|null|undefined)} inputs - Class values to merge
 * @returns {string} Merged class string
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
