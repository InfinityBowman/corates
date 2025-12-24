/**
 * Tooltip component using Ark UI
 *
 * Supports both high-level convenience API and low-level composition API
 */

import { Tooltip as ArkTooltip, useTooltip } from '@ark-ui/solid/tooltip';
import { Portal } from 'solid-js/web';
import { mergeProps, splitProps, createMemo, Show } from 'solid-js';
import { Z_INDEX } from '../constants/zIndex.js';

/**
 * Tooltip - High-level convenience component
 *
 * Props:
 * - content: string | JSX.Element - Tooltip content
 * - children: JSX.Element - Trigger element (will be wrapped)
 * - placement: Placement - Tooltip placement (default: 'top')
 * - openDelay: number - Delay before opening (default: 400ms)
 * - closeDelay: number - Delay before closing (default: 150ms)
 * - interactive: boolean - Allow interaction with tooltip content (default: false)
 * - disabled: boolean - Disable the tooltip
 * - open: boolean - Controlled open state
 * - defaultOpen: boolean - Initial open state (uncontrolled)
 * - onOpenChange: (details: { open: boolean }) => void - Callback when open state changes
 * - showArrow: boolean - Show arrow pointing to trigger (default: true)
 * - lazyMount: boolean - Enable lazy mounting (default: true)
 * - unmountOnExit: boolean - Unmount on exit (default: true)
 * - closeOnClick: boolean - Close on click (default: true)
 * - closeOnScroll: boolean - Close on scroll (default: true)
 * - closeOnPointerDown: boolean - Close on pointer down (default: true)
 * - closeOnEscape: boolean - Close on escape key (default: true)
 * - positioning: PositioningOptions - Custom positioning options
 * - class: string - Additional class for root element
 * - contentClass: string - Additional class for content element
 * - All other Ark UI Tooltip.Root props are supported
 */
export default function TooltipComponent(props) {
  const merged = mergeProps(
    {
      placement: 'top',
      openDelay: 400,
      closeDelay: 150,
      interactive: false,
      showArrow: true,
      lazyMount: true,
      unmountOnExit: true,
      closeOnClick: true,
      closeOnScroll: true,
      closeOnPointerDown: true,
      closeOnEscape: true,
    },
    props,
  );

  const [local, machineProps] = splitProps(merged, [
    'content',
    'children',
    'placement',
    'showArrow',
    'class',
    'contentClass',
  ]);

  const content = () => local.content;
  const children = () => local.children;
  const showArrow = () => local.showArrow;
  const placement = () => local.placement;

  // Calculate boundary for positioning (avoid navbar overlap)
  const getBoundary = createMemo(() => {
    if (typeof document === 'undefined') return 'viewport';
    const navbar = document.querySelector('nav[class*="sticky"]');
    if (navbar) {
      const navbarRect = navbar.getBoundingClientRect();
      return {
        x: 0,
        y: navbarRect.bottom,
        width: window.innerWidth,
        height: window.innerHeight - navbarRect.bottom,
      };
    }
    return 'viewport';
  });

  const positioning = createMemo(() => ({
    placement: placement(),
    gutter: 8,
    strategy: 'fixed',
    flip: true,
    boundary: getBoundary(),
    ...machineProps.positioning,
  }));

  return (
    <ArkTooltip.Root {...machineProps} positioning={positioning()} class={local.class}>
      <ArkTooltip.Trigger>{children()}</ArkTooltip.Trigger>
      <Portal>
        <ArkTooltip.Positioner class={Z_INDEX.TOOLTIP}>
          <Show when={showArrow()}>
            <ArkTooltip.Arrow class='[--arrow-background:#111827] [--arrow-size:8px]'>
              <ArkTooltip.ArrowTip />
            </ArkTooltip.Arrow>
          </Show>
          <ArkTooltip.Content
            class={`data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out pointer-events-none max-w-xs rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg ${local.contentClass || ''}`}
          >
            {content()}
          </ArkTooltip.Content>
        </ArkTooltip.Positioner>
      </Portal>
    </ArkTooltip.Root>
  );
}

// Export high-level component
export { TooltipComponent as Tooltip };

// Export hook for programmatic control
export { useTooltip };
