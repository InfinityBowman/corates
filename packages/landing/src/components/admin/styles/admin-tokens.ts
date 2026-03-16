/**
 * Admin Dashboard Design Tokens
 *
 * Centralized style definitions for consistent admin UI.
 * Framework-agnostic Tailwind class constants.
 */

export const spacingScale: Record<number, string> = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
};

export const radiusScale: Record<string, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  '4xl': 'rounded-[2rem]',
  full: 'rounded-full',
};

export const shadowScale: Record<string, string> = {
  xs: 'shadow-xs',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
};

export const textColors: Record<string, string> = {
  primary: 'text-gray-900',
  secondary: 'text-gray-500',
  tertiary: 'text-gray-400',
  disabled: 'text-gray-300',
  inverse: 'text-white',
  link: 'text-blue-600 hover:text-blue-700',
  error: 'text-red-600',
  success: 'text-green-600',
  warning: 'text-yellow-600',
};

export const bgColors: Record<string, string> = {
  page: 'bg-gray-50',
  card: 'bg-white',
  elevated: 'bg-white',
  subtle: 'bg-gray-50',
  hover: 'hover:bg-gray-50',
  active: 'bg-blue-50',
  tableHeader: 'bg-gray-50',
  selected: 'bg-blue-50',
};

export const statusBadge: Record<string, string> = {
  base: 'inline-flex items-center justify-center rounded-[0.5em] px-[0.7em] py-[0.3em] text-sm font-medium',
  small: 'px-[0.4em] py-[0.1em] text-[10px]',
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-800',
  purple: 'bg-purple-100 text-purple-800',
};

export const typography: Record<string, string> = {
  h1: 'text-2xl font-bold text-gray-900',
  h2: 'text-lg font-medium text-gray-900',
  h3: 'text-base font-medium text-gray-900',
  h4: 'text-sm font-medium text-gray-900',
  body: 'text-sm text-gray-900',
  bodySecondary: 'text-sm text-gray-500',
  bodyTertiary: 'text-sm text-gray-400',
  caption: 'text-xs text-gray-500',
  label: 'text-sm font-medium text-gray-700',
  code: 'font-mono text-sm',
  codeSmall: 'font-mono text-xs',
  tableHeader: 'text-xs font-medium tracking-wider text-gray-500 uppercase',
  tableCell: 'text-sm text-gray-900',
};

export const spacing: Record<string, string> = {
  cardPadding: 'p-6',
  cardPaddingCompact: 'p-4',
  cardPaddingSpacious: 'p-8',
  sectionMargin: 'mb-6',
  pageSectionMargin: 'mb-8',
  tableCellPadding: 'px-6 py-4',
  tableHeaderPadding: 'px-6 py-3',
  tableCellPaddingCompact: 'px-4 py-3',
  tableHeaderPaddingCompact: 'px-4 py-2',
  gridGap: 'gap-4',
  gridGapLg: 'gap-6',
  flexGap: 'gap-3',
  inlineGap: 'gap-2',
  sectionGap: 'gap-6',
  sectionGapCompact: 'gap-4',
};

export const radius: Record<string, string> = {
  card: 'rounded-xl',
  cardLg: 'rounded-2xl',
  button: 'rounded-xl',
  buttonSm: 'rounded-lg',
  badge: 'rounded-[0.5em]',
  input: 'rounded-xl',
  table: 'rounded-xl',
};

export const shadows: Record<string, string> = {
  card: 'shadow-xs',
  cardHover: 'hover:shadow-sm',
  dropdown: 'shadow-lg',
  modal: 'shadow-xl',
};

export const borders: Record<string, string> = {
  card: 'border border-gray-200',
  input: 'border border-gray-200',
  inputFocus: 'border-blue-300',
  divider: 'border-b border-gray-200',
  table: 'border border-gray-200',
};

export const focus: Record<string, string> = {
  ring: 'focus:outline-none focus:ring-[3px] focus:ring-blue-100',
  ringOffset: 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
  input: 'focus:outline-none focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100',
  inputError: 'focus:outline-none focus:border-red-300 focus:ring-[3px] focus:ring-red-100',
};

const buttonBase =
  'inline-flex items-center justify-center cursor-pointer font-medium select-none text-sm transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap';

const buttonVariantStyles: Record<string, string> = {
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

const buttonSizeStyles: Record<string, string> = {
  default: 'h-10 px-4 py-2 rounded-xl',
  sm: 'h-8 px-3 py-1.5 text-xs rounded-lg',
  lg: 'h-12 px-5 py-3 rounded-2xl',
  icon: 'h-8 w-8 p-2 rounded-lg',
};

export function buttonVariants(variant = 'default', size = 'default'): string {
  return `${buttonBase} ${buttonVariantStyles[variant] || buttonVariantStyles.default} ${buttonSizeStyles[size] || buttonSizeStyles.default}`;
}

export const button: Record<string, string> = {
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

export const card: Record<string, string> = {
  base: 'rounded-xl border border-gray-200 bg-white shadow-xs',
  header: 'border-b border-gray-200 px-6 py-4',
  body: 'p-6',
  bodyCompact: 'p-4',
  bodySpacious: 'p-8',
  footer: 'border-t border-gray-200 px-6 py-4',
};

export const table: Record<string, string> = {
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

export const input: Record<string, string> = {
  base: 'w-full h-10 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-xs placeholder:text-gray-400 focus:outline-none focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100',
  withIconLeft: 'pl-10',
  withIconRight: 'pr-10',
  error:
    'border-red-300 focus:border-red-300 focus:ring-red-100 text-red-900 placeholder:text-red-300',
  disabled: 'bg-gray-50 text-gray-500 cursor-not-allowed',
  select:
    'h-10 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100',
};

export const alert: Record<string, string> = {
  base: 'rounded-xl border p-4',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-green-200 bg-green-50 text-green-700',
  warning: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  error: 'border-red-200 bg-red-50 text-red-700',
};

export const loading: Record<string, string> = {
  container: 'flex items-center justify-center',
  containerFull: 'flex min-h-100 items-center justify-center',
  spinner: 'h-8 w-8 animate-spin text-blue-600',
  spinnerSmall: 'h-6 w-6 animate-spin text-blue-500',
  spinnerInline: 'h-4 w-4 animate-spin',
  skeleton: 'animate-pulse rounded bg-gray-200',
  skeletonText: 'h-4 w-3/4 animate-pulse rounded bg-gray-200',
  skeletonCircle: 'h-10 w-10 animate-pulse rounded-full bg-gray-200',
};

export const iconSize: Record<string, string> = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
  '2xl': 'h-12 w-12',
};

export const adminStyles = {
  spacingScale,
  radiusScale,
  shadowScale,
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

/** Combine multiple class strings, filtering out falsy values */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

type StatusVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'purple';
type BadgeSize = 'default' | 'small';

export function getStatusBadgeClass(variant: StatusVariant, size: BadgeSize = 'default'): string {
  const baseClass = size === 'small' ? cx(statusBadge.base, statusBadge.small) : statusBadge.base;
  return cx(baseClass, statusBadge[variant] || statusBadge.neutral);
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'dangerOutline' | 'ghost' | 'link';

export function getButtonClass(
  variant: ButtonVariant = 'primary',
  options: { small?: boolean; icon?: boolean } = {},
): string {
  const classes = [button.base, button[variant] || button.primary];
  if (options.small) classes.push(button.small);
  if (options.icon) classes.push(button.icon);
  return cx(...classes);
}

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export function getAlertClass(variant: AlertVariant = 'info'): string {
  return cx(alert.base, alert[variant] || alert.info);
}

export function getInputClass(
  options: { error?: boolean; disabled?: boolean; iconLeft?: boolean; iconRight?: boolean } = {},
): string {
  const classes: string[] = [input.base];
  if (options.error) classes.push(input.error);
  if (options.disabled) classes.push(input.disabled);
  if (options.iconLeft) classes.push(input.withIconLeft);
  if (options.iconRight) classes.push(input.withIconRight);
  return cx(...classes);
}

export default adminStyles;
