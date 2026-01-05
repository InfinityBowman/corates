/**
 * Spinner - Loading spinner components with multiple variants
 *
 * Provides both inline icon spinners and full-page loading states.
 */

import { Component, splitProps, Show, JSX } from 'solid-js';
import { cn } from '../lib/cn';

// Size mappings for the spinner
const sizeClasses = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
} as const;

// Border width mappings
const borderWidthClasses = {
  xs: 'border',
  sm: 'border-2',
  md: 'border-2',
  lg: 'border-[3px]',
  xl: 'border-4',
} as const;

// Color variant mappings
const variantClasses = {
  default: 'border-blue-600',
  primary: 'border-blue-600',
  secondary: 'border-gray-600',
  success: 'border-green-600',
  warning: 'border-yellow-600',
  error: 'border-red-600',
  white: 'border-white',
} as const;

export type SpinnerSize = keyof typeof sizeClasses;
export type SpinnerVariant = keyof typeof variantClasses;

export interface SpinnerProps {
  /** Size of the spinner */
  size?: SpinnerSize;
  /** Color variant */
  variant?: SpinnerVariant;
  /** Additional CSS classes */
  class?: string;
  /** Accessible label for screen readers */
  label?: string;
}

/**
 * Spinner - Inline loading spinner icon
 *
 * A simple circular spinner for inline loading states.
 * Uses CSS animations for smooth, performant rotation.
 */
export const Spinner: Component<SpinnerProps> = props => {
  const [local] = splitProps(props, ['size', 'variant', 'class', 'label']);

  const size = () => local.size ?? 'md';
  const variant = () => local.variant ?? 'default';

  return (
    <div
      role='status'
      aria-label={local.label ?? 'Loading'}
      class={cn(
        'inline-block animate-spin rounded-full border-transparent',
        sizeClasses[size()],
        borderWidthClasses[size()],
        variantClasses[variant()],
        'border-t-blue-200',
        local.class,
      )}
    >
      <span class='sr-only'>{local.label ?? 'Loading'}</span>
    </div>
  );
};

export interface PageLoaderProps {
  /** Size of the spinner */
  size?: SpinnerSize;
  /** Color variant */
  variant?: SpinnerVariant;
  /** Loading message to display */
  message?: string;
  /** Show a subtle background overlay */
  overlay?: boolean;
  /** Additional CSS classes for the container */
  class?: string;
  /** Additional CSS classes for the message */
  messageClass?: string;
}

/**
 * PageLoader - Full-page centered loading spinner
 *
 * A centered spinner with optional message for page-level loading states.
 * Can be used as an overlay or inline content replacement.
 */
export const PageLoader: Component<PageLoaderProps> = props => {
  const [local] = splitProps(props, [
    'size',
    'variant',
    'message',
    'overlay',
    'class',
    'messageClass',
  ]);

  const size = () => local.size ?? 'xl';
  const variant = () => local.variant ?? 'primary';

  const content = (
    <div
      class={cn(
        'flex flex-col items-center justify-center gap-4',
        local.overlay && 'rounded-lg bg-white/90 p-8 shadow-lg backdrop-blur-sm',
        local.class,
      )}
    >
      <Spinner size={size()} variant={variant()} label={local.message ?? 'Loading page'} />
      <Show when={local.message}>
        <p class={cn('text-sm text-gray-600', local.messageClass)}>{local.message}</p>
      </Show>
    </div>
  );

  return (
    <Show
      when={local.overlay}
      fallback={<div class='flex min-h-50 w-full items-center justify-center'>{content}</div>}
    >
      <div class='fixed inset-0 z-50 flex items-center justify-center bg-gray-900/20 backdrop-blur-sm'>
        {content}
      </div>
    </Show>
  );
};

export interface LoadingPlaceholderProps {
  /** Height of the placeholder */
  height?: string;
  /** Additional CSS classes */
  class?: string;
  /** Spinner size */
  spinnerSize?: SpinnerSize;
  /** Color variant */
  variant?: SpinnerVariant;
  /** Optional message */
  message?: string;
}

/**
 * LoadingPlaceholder - A placeholder component for content loading states
 *
 * Useful for replacing content areas while data is being fetched.
 * Maintains layout space and provides visual feedback.
 */
export const LoadingPlaceholder: Component<LoadingPlaceholderProps> = props => {
  const [local] = splitProps(props, ['height', 'class', 'spinnerSize', 'variant', 'message']);

  return (
    <div
      class={cn(
        'flex w-full items-center justify-center rounded-lg border border-gray-200 bg-gray-50/50',
        local.class,
      )}
      style={{ 'min-height': local.height ?? '120px' }}
    >
      <div class='flex flex-col items-center gap-2'>
        <Spinner size={local.spinnerSize ?? 'md'} variant={local.variant ?? 'default'} />
        <Show when={local.message}>
          <p class='text-xs text-gray-500'>{local.message}</p>
        </Show>
      </div>
    </div>
  );
};

export interface ButtonSpinnerProps {
  /** Show the spinner (typically based on loading state) */
  loading?: boolean;
  /** Content to show when not loading */
  children: JSX.Element;
  /** Spinner size - defaults to 'sm' for buttons */
  size?: SpinnerSize;
  /** Spinner color - defaults to 'white' for contrast on colored buttons */
  variant?: SpinnerVariant;
  /** Additional class for the wrapper */
  class?: string;
}

/**
 * ButtonSpinner - A wrapper for button content that shows a spinner when loading
 *
 * Maintains button width by keeping children in the DOM but hidden.
 */
export const ButtonSpinner: Component<ButtonSpinnerProps> = props => {
  const [local] = splitProps(props, ['loading', 'children', 'size', 'variant', 'class']);

  return (
    <span class={cn('relative inline-flex items-center justify-center', local.class)}>
      <span class={cn('transition-opacity', local.loading ? 'opacity-0' : 'opacity-100')}>
        {local.children}
      </span>
      <Show when={local.loading}>
        <span class='absolute inset-0 flex items-center justify-center'>
          <Spinner size={local.size ?? 'sm'} variant={local.variant ?? 'white'} />
        </span>
      </Show>
    </span>
  );
};
