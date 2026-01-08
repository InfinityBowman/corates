/**
 * Admin Dashboard Design Tokens
 *
 * Centralized style definitions for consistent admin UI.
 * Based on Polar's design system patterns.
 *
 * Import these tokens in admin components instead of hardcoding Tailwind classes.
 *
 * Usage:
 *   import { adminStyles, buttonVariants } from '@/components/admin/styles/admin-tokens.js';
 *   <div class={adminStyles.card.base}>...</div>
 *   <button class={buttonVariants('primary', 'default')}>Click</button>
 */

// ============================================================================
// SPACING SCALE
// ============================================================================

export const spacingScale = {
  1: '0.25rem', // 4px
  2: '0.5rem', // 8px
  3: '0.75rem', // 12px
  4: '1rem', // 16px
  5: '1.25rem', // 20px
  6: '1.5rem', // 24px
  8: '2rem', // 32px
  10: '2.5rem', // 40px
  12: '3rem', // 48px
};

// ============================================================================
// BORDER RADIUS SCALE
// ============================================================================

export const radiusScale = {
  sm: 'rounded-sm', // 0.125rem
  md: 'rounded-md', // 0.375rem
  lg: 'rounded-lg', // 0.5rem
  xl: 'rounded-xl', // 0.75rem
  '2xl': 'rounded-2xl', // 1rem
  '4xl': 'rounded-[2rem]', // 2rem (Polar's large cards)
  full: 'rounded-full',
};

// ============================================================================
// SHADOW SCALE (Softer, Polar-style)
// ============================================================================

export const shadowScale = {
  xs: 'shadow-xs', // Very subtle
  sm: 'shadow-sm', // Default cards
  md: 'shadow-md', // Elevated
  lg: 'shadow-lg', // Dropdowns, modals
};

// ============================================================================
// TEXT COLORS
// ============================================================================

export const textColors = {
  primary: 'text-gray-900', // Headings, primary content
  secondary: 'text-gray-500', // Descriptions, labels
  tertiary: 'text-gray-400', // Hints, placeholders
  disabled: 'text-gray-300', // Disabled states
  inverse: 'text-white', // On dark backgrounds
  link: 'text-blue-600 hover:text-blue-700',
  error: 'text-red-600',
  success: 'text-green-600',
  warning: 'text-yellow-600',
};

// ============================================================================
// BACKGROUND COLORS
// ============================================================================

export const bgColors = {
  page: 'bg-gray-50', // Page background (Polar uses gray-100)
  card: 'bg-white', // Card/box background
  elevated: 'bg-white', // Elevated surfaces
  subtle: 'bg-gray-50', // Subtle backgrounds (table headers)
  hover: 'hover:bg-gray-50', // Hover states
  active: 'bg-blue-50', // Active/selected states
  tableHeader: 'bg-gray-50',
  selected: 'bg-blue-50',
};

// ============================================================================
// STATUS BADGES
// ============================================================================

export const statusBadge = {
  base: 'inline-flex items-center justify-center rounded-[0.5em] px-[0.7em] py-[0.3em] text-sm font-medium',
  small: 'px-[0.4em] py-[0.1em] text-[10px]',
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-800',
  purple: 'bg-purple-100 text-purple-800',
};

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
  // Headings
  h1: 'text-2xl font-bold text-gray-900',
  h2: 'text-lg font-medium text-gray-900', // Polar uses font-medium for section titles
  h3: 'text-base font-medium text-gray-900',
  h4: 'text-sm font-medium text-gray-900',

  // Body text
  body: 'text-sm text-gray-900',
  bodySecondary: 'text-sm text-gray-500',
  bodyTertiary: 'text-sm text-gray-400',

  // Captions and labels
  caption: 'text-xs text-gray-500',
  label: 'text-sm font-medium text-gray-700',

  // Code
  code: 'font-mono text-sm',
  codeSmall: 'font-mono text-xs',

  // Table
  tableHeader: 'text-xs font-medium tracking-wider text-gray-500 uppercase',
  tableCell: 'text-sm text-gray-900',
};

// ============================================================================
// SPACING (Tailwind classes)
// ============================================================================

export const spacing = {
  // Card/section padding
  cardPadding: 'p-6',
  cardPaddingCompact: 'p-4',
  cardPaddingSpacious: 'p-8',

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
  gridGapLg: 'gap-6',
  flexGap: 'gap-3',
  inlineGap: 'gap-2',
  sectionGap: 'gap-6',
  sectionGapCompact: 'gap-4',
};

// ============================================================================
// BORDER RADIUS (Tailwind classes)
// ============================================================================

export const radius = {
  card: 'rounded-xl', // Polar uses rounded-xl for cards
  cardLg: 'rounded-2xl', // For larger containers
  button: 'rounded-xl', // Polar uses rounded-xl for buttons
  buttonSm: 'rounded-lg',
  badge: 'rounded-[0.5em]', // Polar's badge radius
  input: 'rounded-xl', // Polar uses rounded-xl for inputs
  table: 'rounded-xl', // Table container
};

// ============================================================================
// SHADOWS (Tailwind classes)
// ============================================================================

export const shadows = {
  card: 'shadow-xs', // Polar uses very subtle shadows
  cardHover: 'hover:shadow-sm',
  dropdown: 'shadow-lg',
  modal: 'shadow-xl',
};

// ============================================================================
// BORDERS
// ============================================================================

export const borders = {
  card: 'border border-gray-200',
  input: 'border border-gray-200', // Polar uses lighter borders
  inputFocus: 'border-blue-300',
  divider: 'border-b border-gray-200',
  table: 'border border-gray-200',
};

// ============================================================================
// FOCUS STYLES (Polar-style softer focus rings)
// ============================================================================

export const focus = {
  // Softer focus ring (Polar style)
  ring: 'focus:outline-none focus:ring-[3px] focus:ring-blue-100',
  ringOffset: 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',

  // Input focus (Polar style)
  input: 'focus:outline-none focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100',

  // Error focus
  inputError: 'focus:outline-none focus:border-red-300 focus:ring-[3px] focus:ring-red-100',
};

// ============================================================================
// BUTTON VARIANTS (CVA-style pattern from Polar)
// ============================================================================

const buttonBase =
  'inline-flex items-center justify-center cursor-pointer font-medium select-none text-sm transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap';

const buttonVariantStyles = {
  default:
    'bg-blue-600 text-white hover:bg-blue-700 border border-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
  destructive:
    'bg-red-500 text-white hover:bg-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
  outline:
    'border border-gray-200 bg-transparent hover:bg-gray-50 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
  secondary:
    'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
  ghost: 'bg-transparent hover:bg-gray-100 text-gray-900 focus:ring-2 focus:ring-blue-500',
  link: 'text-blue-600 hover:underline bg-transparent underline-offset-4',
};

const buttonSizeStyles = {
  default: 'h-10 px-4 py-2 rounded-xl',
  sm: 'h-8 px-3 py-1.5 text-xs rounded-lg',
  lg: 'h-12 px-5 py-3 rounded-2xl',
  icon: 'h-8 w-8 p-2 rounded-lg',
};

/**
 * Get button classes using CVA-style pattern
 * @param {'default'|'destructive'|'outline'|'secondary'|'ghost'|'link'} variant
 * @param {'default'|'sm'|'lg'|'icon'} size
 * @returns {string} Combined button classes
 */
export function buttonVariants(variant = 'default', size = 'default') {
  return `${buttonBase} ${buttonVariantStyles[variant] || buttonVariantStyles.default} ${buttonSizeStyles[size] || buttonSizeStyles.default}`;
}

// Legacy button object (for backwards compatibility)
export const button = {
  base: 'inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none',
  secondary:
    'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none',
  dangerOutline:
    'border border-red-300 bg-white text-red-600 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none',
  ghost:
    'text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none',
  link: 'text-blue-600 hover:text-blue-700 focus:outline-none',
  small: 'px-3 py-1.5 text-sm rounded-lg',
  icon: 'p-2',
};

// ============================================================================
// CARD STYLES
// ============================================================================

export const card = {
  // Base card (Polar-style: rounded-xl, subtle shadow)
  base: 'rounded-xl border border-gray-200 bg-white shadow-xs',
  // Card sections
  header: 'border-b border-gray-200 px-6 py-4',
  body: 'p-6',
  bodyCompact: 'p-4',
  bodySpacious: 'p-8',
  footer: 'border-t border-gray-200 px-6 py-4',
};

// ============================================================================
// TABLE STYLES
// ============================================================================

export const table = {
  container: 'overflow-hidden rounded-xl border border-gray-200',
  base: 'w-full',
  header: 'border-b border-gray-200 bg-gray-50',
  headerCell: 'px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase',
  headerCellSortable: 'cursor-pointer select-none hover:bg-gray-100',
  body: 'divide-y divide-gray-200 bg-white',
  row: 'transition-colors hover:bg-gray-50',
  rowClickable: 'cursor-pointer',
  cell: 'px-6 py-4 text-sm text-gray-900',
  cellCompact: 'px-4 py-3 text-sm text-gray-900',
};

// ============================================================================
// INPUT STYLES (Polar-style)
// ============================================================================

export const input = {
  base: 'w-full h-10 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-xs placeholder:text-gray-400 focus:outline-none focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100',
  withIconLeft: 'pl-10',
  withIconRight: 'pr-10',
  error:
    'border-red-300 focus:border-red-300 focus:ring-red-100 text-red-900 placeholder:text-red-300',
  disabled: 'bg-gray-50 text-gray-500 cursor-not-allowed',
  select:
    'h-10 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100',
};

// ============================================================================
// ALERT/BANNER STYLES
// ============================================================================

export const alert = {
  base: 'rounded-xl border p-4',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-green-200 bg-green-50 text-green-700',
  warning: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  error: 'border-red-200 bg-red-50 text-red-700',
};

// ============================================================================
// LOADING STATES
// ============================================================================

export const loading = {
  container: 'flex items-center justify-center',
  containerFull: 'flex min-h-100 items-center justify-center',
  spinner: 'h-8 w-8 animate-spin text-blue-600',
  spinnerSmall: 'h-6 w-6 animate-spin text-blue-500',
  spinnerInline: 'h-4 w-4 animate-spin',
  skeleton: 'animate-pulse rounded bg-gray-200',
  skeletonText: 'h-4 w-3/4 animate-pulse rounded bg-gray-200',
  skeletonCircle: 'h-10 w-10 animate-pulse rounded-full bg-gray-200',
};

// ============================================================================
// ICON SIZES
// ============================================================================

export const iconSize = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
  '2xl': 'h-12 w-12',
};

// ============================================================================
// COMBINED STYLE OBJECTS
// ============================================================================

export const adminStyles = {
  // Scales
  spacingScale,
  radiusScale,
  shadowScale,

  // Colors
  textColors,
  bgColors,

  // Components
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Combine multiple class strings, filtering out falsy values
 * @param {...string} classes - Class strings to combine
 * @returns {string} Combined class string
 */
export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Get status badge classes
 * @param {'success'|'error'|'warning'|'info'|'neutral'|'purple'} variant
 * @param {'default'|'small'} size
 * @returns {string} Combined badge classes
 */
export function getStatusBadgeClass(variant, size = 'default') {
  const baseClass = size === 'small' ? cx(statusBadge.base, statusBadge.small) : statusBadge.base;
  return cx(baseClass, statusBadge[variant] || statusBadge.neutral);
}

/**
 * Get button classes (legacy helper, prefer buttonVariants)
 * @param {'primary'|'secondary'|'danger'|'dangerOutline'|'ghost'|'link'} variant
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
 * @param {'info'|'success'|'warning'|'error'} variant
 * @returns {string} Combined alert classes
 */
export function getAlertClass(variant = 'info') {
  return cx(alert.base, alert[variant] || alert.info);
}

/**
 * Get input classes with optional states
 * @param {object} options - { error?: boolean, disabled?: boolean, iconLeft?: boolean, iconRight?: boolean }
 * @returns {string} Combined input classes
 */
export function getInputClass(options = {}) {
  const classes = [input.base];
  if (options.error) classes.push(input.error);
  if (options.disabled) classes.push(input.disabled);
  if (options.iconLeft) classes.push(input.withIconLeft);
  if (options.iconRight) classes.push(input.withIconRight);
  return cx(...classes);
}

export default adminStyles;
