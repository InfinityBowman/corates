/**
 * Toast components using Ark UI
 */

import {
  Toast,
  Toaster,
  createToaster,
  type ToastPromiseOptions,
} from '@ark-ui/solid/toast';
import { Component, Show } from 'solid-js';
import { FiX, FiCheck, FiAlertCircle, FiInfo, FiLoader } from 'solid-icons/fi';
import { Z_INDEX } from '../constants/zIndex.js';

export interface ToastOptions {
  /** Toast title */
  title?: string;
  /** Toast description */
  description?: string;
  /** Toast type */
  type?: 'info' | 'success' | 'warning' | 'error' | 'loading';
  /** Duration in milliseconds */
  duration?: number;
}

/**
 * Create the toast store - this is the global toaster instance
 * Import this to create toasts from anywhere in the app
 */
export const toaster = createToaster({
  placement: 'top-end',
  overlap: true,
  gap: 12,
  offset: '16px',
});

/**
 * Toaster component - renders all active toasts
 */
const ToasterComponent: Component = () => {
  const getIcon = (type?: string) => {
    switch (type) {
      case 'success':
        return <FiCheck class='h-5 w-5 text-green-500' />;
      case 'error':
        return <FiAlertCircle class='h-5 w-5 text-red-500' />;
      case 'loading':
        return <FiLoader class='h-5 w-5 animate-spin text-blue-500' />;
      default:
        return <FiInfo class='h-5 w-5 text-blue-500' />;
    }
  };

  const getStyles = (type?: string) => {
    switch (type) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'loading':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  return (
    <Toaster
      toaster={toaster}
      class={`pointer-events-none fixed inset-0 ${Z_INDEX.TOAST} flex flex-col items-end p-4 sm:p-6`}
    >
      {toast => (
        <Toast.Root
          class={`toast-item pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg border shadow-lg ${getStyles(toast().type)}`}
        >
          <div class='p-4'>
            <div class='flex items-start'>
              <div class='shrink-0'>{getIcon(toast().type)}</div>
              <div class='ml-3 w-0 flex-1'>
                <Show when={toast().title}>
                  <Toast.Title class='text-sm font-medium text-gray-900'>
                    {toast().title}
                  </Toast.Title>
                </Show>
                <Show when={toast().description}>
                  <Toast.Description class='mt-1 text-sm text-gray-500'>
                    {toast().description}
                  </Toast.Description>
                </Show>
              </div>
              <div class='ml-4 flex shrink-0'>
                <Toast.CloseTrigger class='inline-flex cursor-pointer rounded-md bg-transparent p-1 text-gray-400 hover:text-gray-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none'>
                  <span class='sr-only'>Close</span>
                  <FiX class='h-5 w-5' />
                </Toast.CloseTrigger>
              </div>
            </div>
          </div>
        </Toast.Root>
      )}
    </Toaster>
  );
};

/**
 * Convenience methods for creating toasts
 */
export const showToast = {
  success: (title?: string, description?: string) =>
    toaster.create({ title, description, type: 'success', duration: 3000 }),

  error: (title?: string, description?: string) =>
    toaster.create({ title, description, type: 'error', duration: 5000 }),

  info: (title?: string, description?: string) =>
    toaster.create({ title, description, type: 'info', duration: 3000 }),

  loading: (title?: string, description?: string) =>
    toaster.create({ title, description, type: 'loading', duration: Infinity }),

  promise: <T,>(promise: Promise<T>, options: ToastPromiseOptions) =>
    toaster.promise(promise, options),

  dismiss: (id: string) => toaster.dismiss(id),

  update: (id: string, options: ToastOptions) => toaster.update(id, options),
};

export { ToasterComponent as Toaster };
export type { ToastPromiseOptions };
