import * as dialog from '@zag-js/dialog';
import { Portal } from 'solid-js/web';
import { useMachine, normalizeProps } from '@zag-js/solid';
import { createMemo, createUniqueId, Show } from 'solid-js';
import { FiX } from 'solid-icons/fi';

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
export function Drawer(props) {
  const open = () => props.open;
  const side = () => props.side || 'right';
  const size = () => props.size || 'md';
  const title = () => props.title;
  const description = () => props.description;
  const children = () => props.children;
  const showHeader = () => props.showHeader ?? true;
  const showBackdrop = () => props.showBackdrop ?? true;

  const service = useMachine(dialog.machine, {
    id: createUniqueId(),
    get open() {
      return open();
    },
    onOpenChange: details => props.onOpenChange?.(details.open),
    closeOnInteractOutside: () => props.closeOnOutsideClick ?? true,
  });

  const api = createMemo(() => dialog.connect(service, normalizeProps));

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
    <Show when={api().open}>
      <Portal>
        {/* Backdrop - optional */}
        <Show when={showBackdrop()}>
          <div
            {...api().getBackdropProps()}
            class='fixed inset-0 bg-black/50 z-50 transition-opacity animate-fade-in'
          />
        </Show>
        {/* Positioner - full height, aligned to side */}
        <div {...api().getPositionerProps()} class={`fixed z-50 ${getPositionClasses()}`}>
          {/* Content - slides in from side */}
          <div
            {...api().getContentProps()}
            class={`bg-white shadow-2xl h-full flex flex-col max-w-full ${getSizeClass()} ${getAnimationClasses()}`}
          >
            {/* Header */}
            <Show when={showHeader()}>
              <div class='flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0'>
                <div class='min-w-0 flex-1'>
                  <Show when={title()}>
                    <h2
                      {...api().getTitleProps()}
                      class='text-lg font-semibold text-gray-900 truncate'
                    >
                      {title()}
                    </h2>
                  </Show>
                  <Show when={description()}>
                    <p
                      {...api().getDescriptionProps()}
                      class='mt-0.5 text-sm text-gray-500 truncate'
                    >
                      {description()}
                    </p>
                  </Show>
                </div>
                <button
                  {...api().getCloseTriggerProps()}
                  class='ml-4 p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors shrink-0'
                >
                  <FiX class='w-5 h-5' />
                </button>
              </div>
            </Show>
            {/* Body - scrollable */}
            <div class='flex-1 overflow-auto'>{children()}</div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}

export default Drawer;
