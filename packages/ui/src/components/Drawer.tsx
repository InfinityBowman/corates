/**
 * Drawer component for sliding panels
 *
 * Provides a slide-in drawer/panel UI pattern for side panels, PDF viewers, etc.
 * Built on Ark UI Dialog with custom slide animations.
 */

import { Dialog as ArkDialog } from '@ark-ui/solid/dialog';
import { Portal } from 'solid-js/web';
import { Component, Show, JSX } from 'solid-js';
import { FiX } from 'solid-icons/fi';
import { Z_INDEX } from '../constants/zIndex.js';

export interface DrawerProps {
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (_open: boolean) => void;
  /** Drawer title */
  title?: string;
  /** Drawer side (default: 'right') */
  side?: 'left' | 'right';
  /** Drawer size (default: 'md') */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Show backdrop (default: true) */
  showBackdrop?: boolean;
  /** Close on outside click (default: true) */
  closeOnOutsideClick?: boolean;
  /** Drawer content */
  children?: JSX.Element;
}

/**
 * Drawer - A sliding panel/drawer component built on Ark UI Dialog
 */
const DrawerComponent: Component<DrawerProps> = props => {
  const open = () => props.open ?? false;
  const side = () => props.side ?? 'right';
  const size = () => props.size ?? 'md';
  const title = () => props.title;
  const children = () => props.children;
  const showBackdrop = () => props.showBackdrop ?? true;
  const closeOnOutsideClick = () => props.closeOnOutsideClick ?? true;

  const handleOpenChange = (details: { open: boolean }) => {
    if (props.onOpenChange) {
      props.onOpenChange(details.open);
    }
  };

  const getSizeClass = () => {
    switch (size()) {
      case 'sm':
        return 'w-80';
      case 'lg':
        return 'w-[32rem]';
      case 'xl':
        return 'w-[40rem]';
      default:
        return 'w-96';
    }
  };

  const getSideClasses = () => {
    const isLeft = side() === 'left';
    const baseClasses = isLeft ? 'left-0' : 'right-0';
    // Default to closed position, transition to open
    const defaultTransform = isLeft ? '-translate-x-full' : 'translate-x-full';
    if (isLeft) {
      return `${baseClasses} ${defaultTransform} data-[state=open]:translate-x-0`;
    } else {
      return `${baseClasses} ${defaultTransform} data-[state=open]:translate-x-0`;
    }
  };

  return (
    <ArkDialog.Root
      open={open()}
      onOpenChange={handleOpenChange}
      closeOnInteractOutside={closeOnOutsideClick()}
      closeOnEscape={true}
      lazyMount={true}
      unmountOnExit={true}
    >
      <Portal>
        {/* Backdrop */}
        <Show when={showBackdrop()}>
          <ArkDialog.Backdrop
            class={`fixed inset-0 ${Z_INDEX.BACKDROP} bg-black/50 transition-opacity duration-300 data-[state=closed]:opacity-0 data-[state=open]:opacity-100`}
          />
        </Show>

        {/* Drawer Positioner */}
        <ArkDialog.Positioner
          class={`fixed top-0 h-screen ${side() === 'left' ? 'left-0' : 'right-0'} ${Z_INDEX.DIALOG}`}
        >
          {/* Drawer Content */}
          <ArkDialog.Content
            class={`h-screen ${getSizeClass()} flex flex-col bg-white shadow-xl transition-transform duration-300 ease-out ${getSideClasses()}`}
            role='dialog'
            aria-modal='true'
            aria-labelledby={title() ? 'drawer-title' : undefined}
          >
            {/* Header */}
            <div class='flex shrink-0 items-center justify-between border-b border-gray-200 p-4'>
              <Show when={title()}>
                <ArkDialog.Title id='drawer-title' class='text-lg font-semibold text-gray-900'>
                  {title()}
                </ArkDialog.Title>
              </Show>
              <ArkDialog.CloseTrigger
                class='ml-auto rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500'
                aria-label='Close drawer'
              >
                <FiX class='h-5 w-5' />
              </ArkDialog.CloseTrigger>
            </div>

            {/* Body */}
            <div class='min-h-0 flex-1 overflow-auto'>{children()}</div>
          </ArkDialog.Content>
        </ArkDialog.Positioner>
      </Portal>
    </ArkDialog.Root>
  );
};

export { DrawerComponent as Drawer };
