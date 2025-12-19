import * as popover from '@zag-js/popover';
import { Portal } from 'solid-js/web';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId, Show, splitProps, mergeProps } from 'solid-js';
import { FiX } from 'solid-icons/fi';

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
export function Popover(props) {
  const [local, machineProps] = splitProps(props, [
    'trigger',
    'children',
    'title',
    'description',
    'showArrow',
    'showCloseButton',
    'inDialog',
    'class',
  ]);

  const context = mergeProps(machineProps, {
    id: createUniqueId(),
    closeOnInteractOutside: true,
    closeOnEscape: true,
  });

  const service = useMachine(popover.machine, context);

  const api = createMemo(() => popover.connect(service, normalizeProps));

  const showCloseButton = () => local.showCloseButton !== false;

  const content = () => (
    <div {...api().getPositionerProps()}>
      <div
        {...api().getContentProps()}
        class={`z-50 max-w-sm min-w-50 rounded-lg border border-gray-200 bg-white shadow-lg ${local.class || ''}`}
      >
        <Show when={local.showArrow}>
          <div {...api().getArrowProps()} class='[--arrow-background:white] [--arrow-size:8px]'>
            <div {...api().getArrowTipProps()} />
          </div>
        </Show>

        <Show when={local.title || showCloseButton()}>
          <div class='flex items-start justify-between border-b border-gray-100 p-3'>
            <div>
              <Show when={local.title}>
                <h3 {...api().getTitleProps()} class='text-sm font-medium text-gray-900'>
                  {local.title}
                </h3>
              </Show>
              <Show when={local.description}>
                <p {...api().getDescriptionProps()} class='mt-1 text-xs text-gray-500'>
                  {local.description}
                </p>
              </Show>
            </div>
            <Show when={showCloseButton()}>
              <button
                {...api().getCloseTriggerProps()}
                class='-mt-1 -mr-1 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500'
              >
                <FiX class='h-4 w-4' />
              </button>
            </Show>
          </div>
        </Show>

        <div class='p-3'>{local.children}</div>
      </div>
    </div>
  );

  return (
    <>
      <button {...api().getTriggerProps()} class='inline-flex'>
        {local.trigger}
      </button>
      <Show when={api().open}>
        <Show when={!local.inDialog} fallback={content()}>
          <Portal>{content()}</Portal>
        </Show>
      </Show>
    </>
  );
}

export default Popover;
