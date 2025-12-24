/**
 * Popover component using Ark UI
 *
 * Supports both high-level convenience API and low-level composition API
 */

import { Popover as ArkPopover, usePopover } from '@ark-ui/solid/popover';
import { mergeProps, splitProps, Show } from 'solid-js';
import { FiX } from 'solid-icons/fi';
import { Z_INDEX } from '../constants/zIndex.js';

/**
 * Popover - Non-modal floating dialog
 *
 * Props:
 * - trigger: JSX.Element - The trigger element (will be wrapped in a button if not a button)
 * - children: JSX.Element - Popover content
 * - title: string - Optional popover title
 * - description: string - Optional popover description
 * - open: boolean - Controlled open state
 * - defaultOpen: boolean - Initial open state
 * - onOpenChange: (details: { open: boolean }) => void - Callback when open state changes
 * - placement: Placement - Popover placement (default: 'bottom')
 * - modal: boolean - Whether to trap focus (default: false)
 * - closeOnInteractOutside: boolean - Close on outside click (default: true)
 * - closeOnEscape: boolean - Close on escape key (default: true)
 * - showArrow: boolean - Show arrow pointing to trigger (default: false)
 * - showCloseButton: boolean - Show close button in header (default: true)
 * - inDialog: boolean - Set to true when used inside a Dialog
 * - class: string - Additional class for content
 */
export default function PopoverComponent(props) {
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

  const handleOpenChange = details => {
    if (machineProps.onOpenChange) {
      machineProps.onOpenChange(details);
    }
  };

  const positioning = () => ({
    placement: machineProps.placement || 'bottom',
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
}

export { PopoverComponent as Popover };

// Export hook for programmatic control
export { usePopover };
