/**
 * Admin Dashboard Design Tokens
 *
 * Centralized style definitions for consistent admin UI.
 * Import these tokens in admin components instead of hardcoding Tailwind classes.
 *
 * Usage:
 *   import { adminStyles } from '@/components/admin/styles/admin-tokens.js';
 *   <div class={adminStyles.card.base}>...</div>
 */

// Text color hierarchy
export const textColors = {
  primary: 'text-gray-900', // Main content, headings, data
  secondary: 'text-gray-500', // Descriptions, timestamps, labels
  tertiary: 'text-gray-400', // Placeholders, disabled, hints
  link: 'text-blue-600 hover:text-blue-700',
  error: 'text-red-600',
  success: 'text-green-600',
  warning: 'text-yellow-600',
};

// Background colors
export const bgColors = {
  page: 'bg-white',
  card: 'bg-white',
  tableHeader: 'bg-gray-50',
  hover: 'hover:bg-gray-50',
  selected: 'bg-blue-50',
};

// Status badge variants
export const statusBadge = {
  base: 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-800',
  purple: 'bg-purple-100 text-purple-800',
};

// Typography
export const typography = {
  h1: 'text-2xl font-bold text-gray-900',
  h2: 'text-lg font-semibold text-gray-900',
  h3: 'text-sm font-semibold text-gray-900',
  body: 'text-sm text-gray-900',
  bodySecondary: 'text-sm text-gray-500',
  caption: 'text-xs text-gray-500',
  code: 'font-mono text-sm',
  codeSmall: 'font-mono text-xs',
  tableHeader: 'text-xs font-medium tracking-wider text-gray-500 uppercase',
};

// Spacing
export const spacing = {
  // Card/section padding
  cardPadding: 'p-6',
  cardPaddingCompact: 'p-4',

  // Section margins
  sectionMargin: 'mb-6',
  pageSectionMargin: 'mb-8',

  // Table cell padding
  tableCellPadding: 'px-6 py-4',
  tableHeaderPadding: 'px-6 py-3',
  tableCellPaddingCompact: 'px-4 py-3',
  tableHeaderPaddingCompact: 'px-4 py-2',

  // Gaps
  gridGap: 'gap-4',
  flexGap: 'gap-3',
  inlineGap: 'gap-2',
};

// Border radius
export const radius = {
  card: 'rounded-lg',
  button: 'rounded-lg',
  badge: 'rounded-full',
  input: 'rounded-lg',
};

// Shadows
export const shadows = {
  card: 'shadow-sm',
  dropdown: 'shadow-lg',
};

// Borders
export const borders = {
  card: 'border border-gray-200',
  input: 'border border-gray-300',
  divider: 'border-b border-gray-200',
};

// Focus styles (standardized for accessibility)
export const focus = {
  ring: 'focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 focus:outline-none',
  input: 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none',
};

// Button variants
export const button = {
  base: 'inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none',
  secondary:
    'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none',
  dangerOutline:
    'border border-red-300 bg-white text-red-600 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none',
  ghost:
    'text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none',
  link: 'text-blue-600 hover:text-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none',
  small: 'px-3 py-1.5 text-sm',
  icon: 'p-2',
};

// Card variants
export const card = {
  base: 'rounded-lg border border-gray-200 bg-white shadow-sm',
  header: 'border-b border-gray-200 px-6 py-4',
  body: 'p-6',
  footer: 'border-t border-gray-200 px-6 py-4',
};

// Table styles
export const table = {
  container: 'overflow-x-auto',
  base: 'w-full',
  header: 'border-b border-gray-200 bg-gray-50',
  headerCell: 'px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase',
  body: 'divide-y divide-gray-200',
  row: 'hover:bg-gray-50',
  cell: 'px-6 py-4',
  cellCompact: 'px-4 py-3',
};

// Input styles
export const input = {
  base: 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none',
  withIcon: 'pl-10',
  select:
    'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none',
};

// Alert/banner variants
export const alert = {
  base: 'rounded-lg border p-4',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-green-200 bg-green-50 text-green-700',
  warning: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  error: 'border-red-200 bg-red-50 text-red-700',
};

// Loading states
export const loading = {
  container: 'flex items-center justify-center',
  containerFull: 'flex min-h-100 items-center justify-center',
  spinner: 'h-8 w-8 animate-spin text-blue-600',
  spinnerSmall: 'h-6 w-6 animate-spin text-blue-500',
  spinnerInline: 'h-4 w-4 animate-spin',
};

// Icon sizes
export const iconSize = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
  '2xl': 'h-12 w-12',
};

// Combined style objects for common patterns
export const adminStyles = {
  textColors,
  bgColors,
  statusBadge,
  typography,
  spacing,
  radius,
  shadows,
  borders,
  focus,
  button,
  card,
  table,
  input,
  alert,
  loading,
  iconSize,
};

/**
 * Helper to combine base + variant classes
 * @param {string} base - Base classes
 * @param {string} variant - Variant classes
 * @returns {string} Combined class string
 */
export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Get status badge classes
 * @param {'success' | 'error' | 'warning' | 'info' | 'neutral' | 'purple'} variant
 * @returns {string} Combined badge classes
 */
export function getStatusBadgeClass(variant) {
  return cx(statusBadge.base, statusBadge[variant] || statusBadge.neutral);
}

/**
 * Get button classes
 * @param {'primary' | 'secondary' | 'danger' | 'dangerOutline' | 'ghost' | 'link'} variant
 * @param {object} options - { small?: boolean, icon?: boolean }
 * @returns {string} Combined button classes
 */
export function getButtonClass(variant = 'primary', options = {}) {
  const classes = [button.base, button[variant] || button.primary];
  if (options.small) classes.push(button.small);
  if (options.icon) classes.push(button.icon);
  return cx(...classes);
}

/**
 * Get alert classes
 * @param {'info' | 'success' | 'warning' | 'error'} variant
 * @returns {string} Combined alert classes
 */
export function getAlertClass(variant = 'info') {
  return cx(alert.base, alert[variant] || alert.info);
}

export default adminStyles;
