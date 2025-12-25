/**
 * Drawer component for sliding panels
 *
 * Provides a slide-in drawer/panel UI pattern for side panels, PDF viewers, etc.
 * Uses CSS transforms for smooth animations without JavaScript animation libraries.
 */

import { Portal } from 'solid-js/web';
import { Component, Show, JSX, onMount, onCleanup, createSignal, createEffect } from 'solid-js';
import { FiX } from 'solid-icons/fi';
import { Z_INDEX } from '../constants/zIndex.js';

export interface DrawerProps {
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
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
 * Drawer - A sliding panel/drawer component
 */
const DrawerComponent: Component<DrawerProps> = props => {
  const open = () => props.open ?? false;
  const side = () => props.side ?? 'right';
  const size = () => props.size ?? 'md';
  const title = () => props.title;
  const children = () => props.children;
  const showBackdrop = () => props.showBackdrop ?? true;
  const closeOnOutsideClick = () => props.closeOnOutsideClick ?? true;

  // Track if drawer should be visible (for animation)
  const [isVisible, setIsVisible] = createSignal(false);

  // When open state changes, handle visibility with a slight delay for animation
  createEffect(() => {
    if (open()) {
      // Small delay to ensure the component is mounted before animating
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
    }
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (props.onOpenChange) {
      props.onOpenChange(newOpen);
    }
  };

  const handleClose = () => {
    handleOpenChange(false);
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (closeOnOutsideClick() && e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open()) {
      handleClose();
    }
  };

  onMount(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

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
    const transformClass = isVisible() ? 'translate-x-0' : isLeft ? '-translate-x-full' : 'translate-x-full';
    return `${baseClasses} ${transformClass}`;
  };

  return (
    <Show when={open()}>
      <Portal>
        {/* Backdrop */}
        <Show when={showBackdrop()}>
          <div
            class={`fixed inset-0 ${Z_INDEX.BACKDROP} bg-black/50 transition-opacity ${
              isVisible() ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={handleBackdropClick}
          />
        </Show>

        {/* Drawer */}
        <div
          class={`fixed top-0 h-screen ${getSideClasses()} ${getSizeClass()} ${Z_INDEX.DIALOG} flex flex-col bg-white shadow-xl transition-transform duration-300 ease-out`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title() ? 'drawer-title' : undefined}
        >
          {/* Header */}
          <div class="flex shrink-0 items-center justify-between border-b border-gray-200 p-4">
            <Show when={title()}>
              <h2 id="drawer-title" class="text-lg font-semibold text-gray-900">
                {title()}
              </h2>
            </Show>
            <button
              onClick={handleClose}
              class="ml-auto rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500"
              aria-label="Close drawer"
            >
              <FiX class="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div class="min-h-0 flex-1 overflow-auto">{children()}</div>
        </div>
      </Portal>
    </Show>
  );
};

export { DrawerComponent as Drawer };
