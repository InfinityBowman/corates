/**
 * Popover component using Ark UI
 *
 * Supports both high-level convenience API and low-level composition API
 */

import { Popover as ArkPopover, usePopover } from '@ark-ui/solid/popover';
import { Component, mergeProps, splitProps, Show, JSX } from 'solid-js';
import { FiX } from 'solid-icons/fi';
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

export interface PopoverProps {
  /** The trigger element */
  trigger: JSX.Element;
  /** Popover content */
  children?: JSX.Element;
  /** Optional popover title */
  title?: string;
  /** Optional popover description */
  description?: string;
  /** Controlled open state */
  open?: boolean;
  /** Initial open state */
  defaultOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (_details: { open: boolean }) => void;
  /** Popover placement (default: 'bottom') */
  placement?: Placement;
  /** Whether to trap focus (default: false) */
  modal?: boolean;
  /** Close on outside click (default: true) */
  closeOnInteractOutside?: boolean;
  /** Close on escape key (default: true) */
  closeOnEscape?: boolean;
  /** Show arrow pointing to trigger (default: false) */
  showArrow?: boolean;
  /** Show close button in header (default: true) */
  showCloseButton?: boolean;
  /** Set to true when used inside a Dialog */
  inDialog?: boolean;
  /** Additional class for content */
  class?: string;
}

/**
 * Popover - Non-modal floating dialog
 */
const PopoverComponent: Component<PopoverProps> = props => {
  const merged = mergeProps(
    {
      placement: 'bottom',
      modal: false,
      closeOnInteractOutside: true,
      closeOnEscape: true,
      showArrow: false,
      showCloseButton: true,
    },
    props,
  );

  const [local, machineProps] = splitProps(merged, [
    'trigger',
    'children',
    'title',
    'description',
    'showArrow',
    'showCloseButton',
    'inDialog',
    'class',
  ]);

  const trigger = () => local.trigger;
  const children = () => local.children;
  const title = () => local.title;
  const description = () => local.description;
  const showArrow = () => local.showArrow;
  const showCloseButton = () => local.showCloseButton !== false;
  const inDialog = () => local.inDialog;
  const classValue = () => local.class;

  const handleOpenChange = (details: { open: boolean }) => {
    if (machineProps.onOpenChange) {
      machineProps.onOpenChange(details);
    }
  };

  const positioning = (): { placement: Placement } => ({
    placement: (machineProps.placement || 'bottom') as Placement,
  });

  return (
    <ArkPopover.Root
      {...machineProps}
      positioning={positioning()}
      portalled={!inDialog()}
      onOpenChange={handleOpenChange}
    >
      <ArkPopover.Trigger class='inline-flex'>{trigger()}</ArkPopover.Trigger>
      <ArkPopover.Positioner>
        <ArkPopover.Content
          class={`${Z_INDEX.POPOVER} max-w-sm min-w-50 rounded-lg border border-gray-200 bg-white shadow-lg ${classValue() || ''}`}
        >
          <Show when={showArrow()}>
            <ArkPopover.Arrow class='[--arrow-background:white] [--arrow-size:8px]'>
              <ArkPopover.ArrowTip />
            </ArkPopover.Arrow>
          </Show>

          <Show when={title() || showCloseButton()}>
            <div class='flex items-start justify-between border-b border-gray-100 p-3'>
              <div>
                <Show when={title()}>
                  <ArkPopover.Title class='text-sm font-medium text-gray-900'>
                    {title()}
                  </ArkPopover.Title>
                </Show>
                <Show when={description()}>
                  <ArkPopover.Description class='mt-1 text-xs text-gray-500'>
                    {description()}
                  </ArkPopover.Description>
                </Show>
              </div>
              <Show when={showCloseButton()}>
                <ArkPopover.CloseTrigger class='-mt-1 -mr-1 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500'>
                  <FiX class='h-4 w-4' />
                </ArkPopover.CloseTrigger>
              </Show>
            </div>
          </Show>

          <div class='p-3'>{children()}</div>
        </ArkPopover.Content>
      </ArkPopover.Positioner>
    </ArkPopover.Root>
  );
};

export { PopoverComponent as Popover };

// Export hook for programmatic control
export { usePopover };
