/**
 * Tooltip component using Ark UI
 *
 * Supports both high-level convenience API and low-level composition API
 */

import { Tooltip as ArkTooltip, useTooltip } from '@ark-ui/solid/tooltip';
import { Portal } from 'solid-js/web';
import { Component, mergeProps, splitProps, createMemo, Show, JSX } from 'solid-js';
import { Z_INDEX } from '../constants/zIndex.js';

export type Placement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'
  | 'right'
  | 'right-start'
  | 'right-end';

export interface TooltipProps {
  /** Tooltip content */
  content: string | JSX.Element;
  /** Trigger element (will be wrapped) */
  children: JSX.Element;
  /** Tooltip placement (default: 'top') */
  placement?: Placement;
  /** Delay before opening (default: 400ms) */
  openDelay?: number;
  /** Delay before closing (default: 150ms) */
  closeDelay?: number;
  /** Allow interaction with tooltip content (default: false) */
  interactive?: boolean;
  /** Disable the tooltip */
  disabled?: boolean;
  /** Controlled open state */
  open?: boolean;
  /** Initial open state (uncontrolled) */
  defaultOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (_details: { open: boolean }) => void;
  /** Show arrow pointing to trigger (default: true) */
  showArrow?: boolean;
  /** Enable lazy mounting (default: true) */
  lazyMount?: boolean;
  /** Unmount on exit (default: true) */
  unmountOnExit?: boolean;
  /** Close on click (default: true) */
  closeOnClick?: boolean;
  /** Close on scroll (default: true) */
  closeOnScroll?: boolean;
  /** Close on pointer down (default: true) */
  closeOnPointerDown?: boolean;
  /** Close on escape key (default: true) */
  closeOnEscape?: boolean;
  /** Custom positioning options */
  positioning?: {
    placement?: Placement;
    gutter?: number;
    strategy?: 'absolute' | 'fixed';
    flip?: boolean;
    boundary?: string | { x: number; y: number; width: number; height: number };
    [key: string]: unknown;
  };
  /** Additional class for root element */
  class?: string;
  /** Additional class for content element */
  contentClass?: string;
}

/**
 * Tooltip - High-level convenience component
 */
const TooltipComponent: Component<TooltipProps> = props => {
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
    'interactive',
    'class',
    'contentClass',
  ]);

  const content = () => local.content;
  const children = () => local.children;
  const showArrow = () => local.showArrow;
  const placement = () => local.placement;
  const interactive = () => local.interactive;

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

  const positioning = createMemo(
    (): {
      placement?: string;
      gutter?: number;
      strategy?: 'absolute' | 'fixed';
      flip?: boolean;
      boundary?: string | { x: number; y: number; width: number; height: number };
      [key: string]: unknown;
    } => ({
      placement: placement(),
      gutter: 8,
      strategy: 'fixed' as const,
      flip: true,
      boundary: getBoundary(),
      ...machineProps.positioning,
    }),
  );

  return (
    <ArkTooltip.Root
      {...machineProps}
      positioning={positioning() as unknown as Parameters<typeof ArkTooltip.Root>[0]['positioning']}
    >
      <ArkTooltip.Trigger>{children()}</ArkTooltip.Trigger>
      <Portal>
        <ArkTooltip.Positioner class={Z_INDEX.TOOLTIP}>
          <Show when={showArrow()}>
            <ArkTooltip.Arrow class='[--arrow-background:#111827] [--arrow-size:8px]'>
              <ArkTooltip.ArrowTip />
            </ArkTooltip.Arrow>
          </Show>
          <ArkTooltip.Content
            class={`data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out ${interactive() ? '' : 'pointer-events-none'} max-w-xs rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg ${local.contentClass || ''}`}
          >
            {content()}
          </ArkTooltip.Content>
        </ArkTooltip.Positioner>
      </Portal>
    </ArkTooltip.Root>
  );
};

// Export high-level component
export { TooltipComponent as Tooltip };

// Export hook for programmatic control
export { useTooltip };
