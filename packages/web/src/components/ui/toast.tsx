/**
 * Toast notification system.
 *
 * Setup: Add <ToasterContainer /> once in your app root.
 *
 * @example
 * // In App.tsx
 * import { ToasterContainer } from '@/components/ui/toast';
 * <ToasterContainer />
 *
 * @example
 * // Show toasts anywhere in your app
 * import { showToast } from '@/components/ui/toast';
 *
 * showToast.success('Saved', 'Your changes have been saved');
 * showToast.error('Error', 'Something went wrong');
 * showToast.warning('Warning', 'This action cannot be undone');
 * showToast.info('Info', 'New updates available');
 *
 * // Loading toast (stays until dismissed)
 * const id = showToast.loading('Uploading...', 'Please wait');
 * // Later: showToast.dismiss(id);
 */
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import {
  Toast as ToastPrimitive,
  Toaster,
  createToaster,
  type ToastPromiseOptions,
} from '@ark-ui/solid/toast';
import type {
  ToastRootProps as ArkToastRootProps,
  ToastTitleProps as ArkToastTitleProps,
  ToastDescriptionProps as ArkToastDescriptionProps,
  ToastCloseTriggerProps as ArkToastCloseTriggerProps,
  ToastActionTriggerProps as ArkToastActionTriggerProps,
} from '@ark-ui/solid/toast';
import { Portal } from 'solid-js/web';
import { FiX, FiCheckCircle, FiAlertCircle, FiAlertTriangle, FiInfo } from 'solid-icons/fi';
import { cn } from './cn';
import { Z_INDEX } from './z-index';

export const toaster = createToaster({
  placement: 'top-end',
  overlap: false,
  gap: 12,
});

const Toast = ToastPrimitive.Root;

type ToastRootProps = ArkToastRootProps & {
  class?: string;
  children?: JSX.Element;
};

const ToastRoot: Component<ToastRootProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <ToastPrimitive.Root
      class={cn(
        'toast-item pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-lg border shadow-lg',
        local.class,
      )}
      {...others}
    >
      {local.children}
    </ToastPrimitive.Root>
  );
};

type ToastTitleProps = ArkToastTitleProps & {
  class?: string;
};

const ToastTitle: Component<ToastTitleProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <ToastPrimitive.Title
      class={cn('text-sm font-semibold text-gray-900', local.class)}
      {...others}
    />
  );
};

type ToastDescriptionProps = ArkToastDescriptionProps & {
  class?: string;
};

const ToastDescription: Component<ToastDescriptionProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <ToastPrimitive.Description class={cn('mt-1 text-sm text-gray-600', local.class)} {...others} />
  );
};

type ToastCloseTriggerProps = ArkToastCloseTriggerProps & {
  class?: string;
  children?: JSX.Element;
};

const ToastCloseTrigger: Component<ToastCloseTriggerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <ToastPrimitive.CloseTrigger
      class={cn(
        'absolute top-2 right-2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500',
        local.class,
      )}
      {...others}
    >
      {local.children ?? <FiX class='h-4 w-4' />}
    </ToastPrimitive.CloseTrigger>
  );
};

type ToastActionTriggerProps = ArkToastActionTriggerProps & {
  class?: string;
  children?: JSX.Element;
};

const ToastActionTrigger: Component<ToastActionTriggerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <ToastPrimitive.ActionTrigger
      class={cn('mt-2 text-sm font-medium text-blue-600 hover:text-blue-700', local.class)}
      {...others}
    >
      {local.children}
    </ToastPrimitive.ActionTrigger>
  );
};

const getToastStyles = (type?: string) => {
  switch (type) {
    case 'success':
      return 'border-green-200 bg-green-50';
    case 'error':
      return 'border-red-200 bg-red-50';
    case 'warning':
      return 'border-amber-200 bg-amber-50';
    case 'loading':
      return 'border-blue-200 bg-blue-50';
    default:
      return 'border-gray-200 bg-white';
  }
};

const ToasterContainer: Component = () => {
  return (
    <Portal>
      <Toaster
        toaster={toaster}
        class={cn(
          'pointer-events-none fixed inset-0 flex flex-col items-end p-4 sm:p-6',
          Z_INDEX.TOAST,
        )}
      >
        {toast => (
          <ToastRoot class={getToastStyles(toast().type)}>
            <div class='p-4'>
              <div class='flex items-start'>
                <div class='shrink-0'>
                  {toast().type === 'success' && <FiCheckCircle class='h-5 w-5 text-green-500' />}
                  {toast().type === 'error' && <FiAlertCircle class='h-5 w-5 text-red-500' />}
                  {toast().type === 'warning' && <FiAlertTriangle class='h-5 w-5 text-amber-500' />}
                  {toast().type === 'info' && <FiInfo class='h-5 w-5 text-blue-500' />}
                  {toast().type === 'loading' && (
                    <div class='h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent' />
                  )}
                </div>
                <div class='ml-3 w-0 flex-1'>
                  {toast().title && <ToastTitle>{toast().title}</ToastTitle>}
                  {toast().description && (
                    <ToastDescription>{toast().description}</ToastDescription>
                  )}
                </div>
                <div class='ml-4 flex shrink-0'>
                  <ToastCloseTrigger class='relative top-0 right-0' />
                </div>
              </div>
            </div>
          </ToastRoot>
        )}
      </Toaster>
    </Portal>
  );
};

interface ToastOptions {
  title: string;
  description?: string;
  duration?: number;
}

const showToast = {
  success: (title: string, description?: string, duration = 3000) => {
    return toaster.create({ title, description, type: 'success', duration });
  },
  error: (title: string, description?: string, duration = 5000) => {
    return toaster.create({ title, description, type: 'error', duration });
  },
  warning: (title: string, description?: string, duration = 5000) => {
    return toaster.create({ title, description, type: 'warning', duration });
  },
  info: (title: string, description?: string, duration = 3000) => {
    return toaster.create({ title, description, type: 'info', duration });
  },
  loading: (title: string, description?: string) => {
    return toaster.create({ title, description, type: 'loading', duration: Infinity });
  },
  dismiss: (id: string) => {
    toaster.dismiss(id);
  },
  update: (id: string, options: ToastOptions) => {
    toaster.update(id, options);
  },
  promise: <T,>(promise: Promise<T>, options: ToastPromiseOptions<T>) => {
    return toaster.promise(promise, options);
  },
};

export {
  Toast,
  ToastRoot,
  ToastTitle,
  ToastDescription,
  ToastCloseTrigger,
  ToastActionTrigger,
  ToasterContainer,
  showToast,
};
export type { ToastOptions, ToastPromiseOptions };
