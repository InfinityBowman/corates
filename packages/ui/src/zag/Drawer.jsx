/**
 * Drawer component using Ark UI Dialog
 */

import { Dialog } from '@ark-ui/solid/dialog';
import { Portal } from 'solid-js/web';
import { Show } from 'solid-js';
import { FiX } from 'solid-icons/fi';
import { Z_INDEX } from '../constants/zIndex.js';

/**
 * Drawer - A slide-in panel component composed from Dialog
 *
 * Props:
 * - open: boolean - Whether the drawer is open
 * - onOpenChange: (open: boolean) => void - Callback when open state changes
 * - title: string - Drawer title
 * - description: string - Optional description below title
 * - children: JSX.Element - Drawer content
 * - side: 'left' | 'right' - Which side the drawer slides in from (default: 'right')
 * - size: 'sm' | 'md' | 'lg' | 'xl' | 'full' - Drawer width (default: 'md')
 * - showHeader: boolean - Whether to show the header (default: true)
 * - closeOnOutsideClick: boolean - Close when clicking backdrop (default: true)
 * - showBackdrop: boolean - Whether to show the dark overlay backdrop (default: true)
 */
export default function DrawerComponent(props) {
  const open = () => props.open;
  const side = () => props.side || 'right';
  const size = () => props.size || 'md';
  const title = () => props.title;
  const description = () => props.description;
  const children = () => props.children;
  const showHeader = () => props.showHeader ?? true;
  const showBackdrop = () => props.showBackdrop ?? true;

  const handleOpenChange = details => {
    if (props.onOpenChange) {
      props.onOpenChange(details.open);
    }
  };

  const getSizeClass = () => {
    switch (size()) {
      case 'sm':
        return 'w-80'; // 320px
      case 'md':
        return 'w-[480px]';
      case 'lg':
        return 'w-[640px]';
      case 'xl':
        return 'w-[800px]';
      case 'full':
        return 'w-full';
      default:
        return 'w-[480px]';
    }
  };

  const getPositionClasses = () => {
    if (side() === 'left') {
      return 'left-0 top-0 bottom-0';
    }
    return 'right-0 top-0 bottom-0';
  };

  const getAnimationClasses = () => {
    // CSS animations for slide in/out
    if (side() === 'left') {
      return 'animate-slide-in-left';
    }
    return 'animate-slide-in-right';
  };

  return (
    <Dialog.Root
      open={open()}
      onOpenChange={handleOpenChange}
      closeOnInteractOutside={props.closeOnOutsideClick ?? true}
    >
      <Show when={open()}>
        <Portal>
          {/* Backdrop - optional */}
          <Show when={showBackdrop()}>
            <Dialog.Backdrop
              class={`animate-fade-in fixed inset-0 ${Z_INDEX.BACKDROP} bg-black/50 transition-opacity`}
            />
          </Show>
          {/* Positioner - full height, aligned to side */}
          <Dialog.Positioner class={`fixed ${Z_INDEX.DIALOG} ${getPositionClasses()}`}>
            {/* Content - slides in from side */}
            <Dialog.Content
              class={`flex h-full max-w-full flex-col bg-white shadow-2xl ${getSizeClass()} ${getAnimationClasses()}`}
            >
              {/* Header */}
              <Show when={showHeader()}>
                <div class='flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3'>
                  <div class='min-w-0 flex-1'>
                    <Show when={title()}>
                      <Dialog.Title class='truncate text-lg font-semibold text-gray-900'>
                        {title()}
                      </Dialog.Title>
                    </Show>
                    <Show when={description()}>
                      <Dialog.Description class='mt-0.5 truncate text-sm text-gray-500'>
                        {description()}
                      </Dialog.Description>
                    </Show>
                  </div>
                  <Dialog.CloseTrigger class='ml-4 shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600'>
                    <FiX class='h-5 w-5' />
                  </Dialog.CloseTrigger>
                </div>
              </Show>
              {/* Body - scrollable */}
              <div class='flex-1 overflow-auto'>{children()}</div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Show>
    </Dialog.Root>
  );
}

export { DrawerComponent as Drawer };
