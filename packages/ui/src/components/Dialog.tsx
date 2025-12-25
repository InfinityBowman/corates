/**
 * Dialog components using Ark UI
 */

import { Dialog as ArkDialog, useDialog } from '@ark-ui/solid/dialog';
import { Portal } from 'solid-js/web';
import { Component, createSignal, Show, JSX } from 'solid-js';
import { FiAlertTriangle, FiX } from 'solid-icons/fi';
import { Z_INDEX } from '../constants/zIndex.js';

export interface DialogProps {
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (_open: boolean) => void;
  /** Dialog title */
  title?: string;
  /** Dialog description */
  description?: string;
  /** Dialog content */
  children?: JSX.Element;
  /** Dialog size */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Dialog - A generic dialog/modal component
 */
const DialogComponent: Component<DialogProps> = props => {
  const open = () => props.open;
  const size = () => props.size;
  const title = () => props.title;
  const description = () => props.description;
  const children = () => props.children;

  const handleOpenChange = (details: { open: boolean }) => {
    if (props.onOpenChange) {
      props.onOpenChange(details.open);
    }
  };

  const getSizeClass = () => {
    switch (size()) {
      case 'sm':
        return 'max-w-sm';
      case 'lg':
        return 'max-w-lg';
      case 'xl':
        return 'max-w-xl';
      default:
        return 'max-w-md';
    }
  };

  return (
    <ArkDialog.Root open={open()} onOpenChange={handleOpenChange}>
      <Show when={open()}>
        <Portal>
          <ArkDialog.Backdrop
            class={`fixed inset-0 ${Z_INDEX.BACKDROP} bg-black/50 transition-opacity`}
          />
          <ArkDialog.Positioner
            class={`fixed inset-0 ${Z_INDEX.DIALOG} flex items-center justify-center overflow-y-auto p-4`}
          >
            <ArkDialog.Content
              class={`my-auto w-full rounded-lg bg-white shadow-xl ${getSizeClass()}`}
            >
              {/* Header */}
              <div class='flex items-center justify-between border-b border-gray-200 p-4'>
                <div>
                  <ArkDialog.Title class='text-lg font-semibold text-gray-900'>
                    {title()}
                  </ArkDialog.Title>
                  <Show when={description()}>
                    <ArkDialog.Description class='mt-1 text-sm text-gray-500'>
                      {description()}
                    </ArkDialog.Description>
                  </Show>
                </div>
                <ArkDialog.CloseTrigger class='rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500'>
                  <FiX class='h-5 w-5' />
                </ArkDialog.CloseTrigger>
              </div>
              {/* Body */}
              <div class='p-4'>{children()}</div>
            </ArkDialog.Content>
          </ArkDialog.Positioner>
        </Portal>
      </Show>
    </ArkDialog.Root>
  );
};

export interface ConfirmDialogProps {
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (_open: boolean) => void;
  /** Callback when user confirms */
  onConfirm?: () => void;
  /** Dialog title */
  title?: string;
  /** Dialog description/message */
  description?: string;
  /** Text for confirm button (default: "Confirm") */
  confirmText?: string;
  /** Text for cancel button (default: "Cancel") */
  cancelText?: string;
  /** Visual variant (default: 'danger') */
  variant?: 'danger' | 'warning' | 'info';
  /** Whether confirm action is in progress */
  loading?: boolean;
}

/**
 * ConfirmDialog - A reusable confirmation dialog component
 */
export const ConfirmDialogComponent: Component<ConfirmDialogProps> = props => {
  const open = () => props.open;
  const loading = () => props.loading;
  const variant = () => props.variant || 'danger';
  const title = () => props.title;
  const description = () => props.description;
  const confirmText = () => props.confirmText;
  const cancelText = () => props.cancelText;

  const handleOpenChange = (details: { open: boolean }) => {
    if (props.onOpenChange) {
      props.onOpenChange(details.open);
    }
  };

  const getVariantStyles = () => {
    switch (variant()) {
      case 'warning':
        return {
          icon: 'text-amber-500',
          iconBg: 'bg-amber-100',
          button: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
        };
      case 'info':
        return {
          icon: 'text-blue-500',
          iconBg: 'bg-blue-100',
          button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
        };
      default: // danger
        return {
          icon: 'text-red-500',
          iconBg: 'bg-red-100',
          button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
        };
    }
  };

  const handleConfirm = () => {
    props.onConfirm?.();
  };

  const handleCancel = () => {
    if (!loading()) {
      props.onOpenChange?.(false);
    }
  };

  return (
    <ArkDialog.Root
      open={open()}
      onOpenChange={handleOpenChange}
      role='alertdialog'
      closeOnInteractOutside={!loading()}
      closeOnEscape={!loading()}
    >
      <Show when={open()}>
        <Portal>
          <ArkDialog.Backdrop
            class={`fixed inset-0 ${Z_INDEX.BACKDROP} bg-black/50 transition-opacity`}
          />
          <ArkDialog.Positioner
            class={`fixed inset-0 ${Z_INDEX.DIALOG} flex items-center justify-center p-4`}
          >
            <ArkDialog.Content class='w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl'>
              <div class='p-6'>
                <div class='flex items-start gap-4'>
                  {/* Icon */}
                  <div class={`shrink-0 rounded-full p-2 ${getVariantStyles().iconBg}`}>
                    <FiAlertTriangle class={`h-6 w-6 ${getVariantStyles().icon}`} />
                  </div>
                  {/* Text content */}
                  <div class='min-w-0 flex-1'>
                    <ArkDialog.Title class='text-lg font-semibold text-gray-900'>
                      {title()}
                    </ArkDialog.Title>
                    <ArkDialog.Description class='mt-2 text-sm text-gray-600'>
                      {description()}
                    </ArkDialog.Description>
                  </div>
                  {/* Close button */}
                  <ArkDialog.CloseTrigger
                    disabled={loading()}
                    class='shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500 disabled:opacity-50'
                  >
                    <FiX class='h-5 w-5' />
                  </ArkDialog.CloseTrigger>
                </div>
              </div>
              {/* Footer */}
              <div class='flex justify-end gap-3 bg-gray-50 px-6 py-4'>
                <button
                  onClick={handleCancel}
                  disabled={loading()}
                  class='rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50'
                >
                  {cancelText() || 'Cancel'}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading()}
                  class={`rounded-md px-4 py-2 text-sm font-medium text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:opacity-50 ${getVariantStyles().button}`}
                >
                  {loading() ? 'Loading...' : confirmText() || 'Confirm'}
                </button>
              </div>
            </ArkDialog.Content>
          </ArkDialog.Positioner>
        </Portal>
      </Show>
    </ArkDialog.Root>
  );
};

export interface ConfirmDialogConfig {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

/**
 * useConfirmDialog - Hook to manage confirm dialog state
 */
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = createSignal(false);
  const [config, setConfig] = createSignal<ConfirmDialogConfig & { loading?: boolean }>({
    title: '',
    description: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'danger',
  });
  const [loading, setLoading] = createSignal(false);

  let resolvePromise: ((_value: boolean) => void) | null = null;

  const open = (dialogConfig: ConfirmDialogConfig) => {
    return new Promise<boolean>(resolve => {
      resolvePromise = resolve;
      setConfig({
        title: dialogConfig.title || 'Confirm',
        description: dialogConfig.description || 'Are you sure?',
        confirmText: dialogConfig.confirmText || 'Confirm',
        cancelText: dialogConfig.cancelText || 'Cancel',
        variant: dialogConfig.variant || 'danger',
      });
      setIsOpen(true);
    });
  };

  const close = () => {
    setIsOpen(false);
    setLoading(false);
    if (resolvePromise) {
      resolvePromise(false);
      resolvePromise = null;
    }
  };

  const handleConfirm = () => {
    if (resolvePromise) {
      resolvePromise(true);
      resolvePromise = null;
    }
    setIsOpen(false);
    setLoading(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      close();
    }
  };

  // Pre-bound component that uses the hook's state
  function ConfirmDialogHookComponent() {
    return (
      <ConfirmDialogComponent
        open={isOpen()}
        onOpenChange={handleOpenChange}
        onConfirm={handleConfirm}
        loading={loading()}
        {...config()}
      />
    );
  }

  return {
    isOpen,
    open,
    close,
    setLoading,
    ConfirmDialogComponent: ConfirmDialogHookComponent,
    dialogProps: () => ({
      open: isOpen(),
      onOpenChange: handleOpenChange,
      onConfirm: handleConfirm,
      loading: loading(),
      ...config(),
    }),
  };
}

export { DialogComponent as Dialog, ConfirmDialogComponent as ConfirmDialog };

// Export hook for programmatic control
export { useDialog };
