/**
 * SlidingPanel - A lightweight, GPU-accelerated sliding panel
 *
 * Optimized for smooth animations without the overhead of Portal/Dialog.
 * Uses CSS transforms and will-change for 60fps animations.
 */

import { Show, createSignal, createEffect, onCleanup } from 'solid-js';
import { FiX } from 'solid-icons/fi';

/**
 * @param {Object} props
 * @param {boolean} props.open - Whether panel is open
 * @param {(open: boolean) => void} props.onClose - Close handler
 * @param {string} [props.title] - Panel title
 * @param {'sm' | 'md' | 'lg' | 'xl' | '2xl'} [props.size='xl'] - Panel width
 * @param {boolean} [props.closeOnOutsideClick=true] - Close when clicking outside
 * @param {import('solid-js').JSX.Element} props.children - Panel content
 */
export default function SlidingPanel(props) {
  const [mounted, setMounted] = createSignal(false);
  const [visible, setVisible] = createSignal(false);

  let panelRef = null;

  const size = () => props.size ?? 'xl';
  const closeOnOutsideClick = () => props.closeOnOutsideClick ?? true;

  const getSizeClass = () => {
    switch (size()) {
      case 'sm':
        return 'w-80';
      case 'md':
        return 'w-96';
      case 'lg':
        return 'w-[32rem]';
      case 'xl':
        return 'w-[40rem]';
      case '2xl':
        return 'w-[48rem]';
      default:
        return 'w-[40rem]';
    }
  };

  // Handle open/close with proper mount/unmount timing
  createEffect(() => {
    if (props.open) {
      // Mount first, then animate in
      setMounted(true);
      // Use RAF to ensure DOM is ready before animating
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
        });
      });
    } else {
      // Animate out first, then unmount
      setVisible(false);
    }
  });

  // Handle unmount after close animation
  const handleTransitionEnd = e => {
    if (e.propertyName === 'transform' && !props.open) {
      setMounted(false);
    }
  };

  // Handle escape key
  createEffect(() => {
    if (!props.open) return;

    const handleKeyDown = e => {
      if (e.key === 'Escape') {
        props.onClose?.(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => document.removeEventListener('keydown', handleKeyDown));
  });

  // Handle click outside
  createEffect(() => {
    if (!props.open || !closeOnOutsideClick()) return;

    const handleClickOutside = e => {
      if (panelRef && !panelRef.contains(e.target)) {
        props.onClose?.(false);
      }
    };

    // Delay adding listener to avoid catching the opening click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);

    onCleanup(() => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    });
  });

  return (
    <Show when={mounted()}>
      {/* Panel container - fixed position, no portal needed */}
      <div
        ref={panelRef}
        class={`fixed inset-y-0 right-0 z-50 ${getSizeClass()} bg-card flex flex-col shadow-2xl`}
        style={{
          transform: visible() ? 'translateX(0) translateZ(0)' : 'translateX(100%) translateZ(0)',
          transition: 'transform 250ms cubic-bezier(0.32, 0.72, 0, 1)',
          'will-change': 'transform',
          'backface-visibility': 'hidden',
        }}
        onTransitionEnd={handleTransitionEnd}
        role='complementary'
        aria-label={props.title || 'Side panel'}
      >
        {/* Header */}
        <div class='border-border flex shrink-0 items-center justify-between border-b px-4 py-3'>
          <Show when={props.title}>
            <h2 class='text-foreground truncate pr-4 text-lg font-semibold'>{props.title}</h2>
          </Show>
          <button
            type='button'
            onClick={() => props.onClose?.(false)}
            class='text-muted-foreground/70 hover:bg-secondary hover:text-secondary-foreground ml-auto rounded-md p-1.5 transition-colors'
            aria-label='Close panel'
          >
            <FiX class='h-5 w-5' />
          </button>
        </div>

        {/* Content */}
        <div class='min-h-0 flex-1 overflow-hidden'>{props.children}</div>
      </div>
    </Show>
  );
}
