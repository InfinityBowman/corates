import * as accordion from '@zag-js/accordion';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId, For, splitProps } from 'solid-js';

/**
 * Accordion - Vertically stacked expandable sections
 *
 * Props:
 * - items: Array<{ value: string, title: JSX.Element, content: JSX.Element, disabled?: boolean }> - Accordion items
 * - defaultValue: string[] - Initially expanded items
 * - value: string[] - Controlled expanded items
 * - onValueChange: (details: { value: string[] }) => void - Callback when expanded items change
 * - multiple: boolean - Allow multiple items expanded (default: false)
 * - collapsible: boolean - Allow collapsing all items (default: true)
 * - disabled: boolean - Disable all items
 * - orientation: 'horizontal' | 'vertical' - Orientation (default: 'vertical')
 * - class: string - Additional class for root element
 */
export function Accordion(props) {
  const [local, machineProps] = splitProps(props, ['items', 'class']);

  const service = useMachine(accordion.machine, () => ({
    ...machineProps,
    id: createUniqueId(),
    collapsible: true,
  }));

  const api = createMemo(() => accordion.connect(service, normalizeProps));

  return (
    <div
      {...api().getRootProps()}
      class={`divide-y divide-gray-200 border border-gray-200 rounded-lg ${local.class || ''}`}
    >
      <For each={local.items}>
        {item => (
          <div {...api().getItemProps({ value: item.value, disabled: item.disabled })}>
            <h3>
              <button
                {...api().getItemTriggerProps({ value: item.value, disabled: item.disabled })}
                class='flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                <span>{item.title}</span>
                <span
                  {...api().getItemIndicatorProps({ value: item.value })}
                  class='ml-2 transition-transform duration-200 data-[state=open]:rotate-180'
                >
                  <svg class='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                    <path
                      stroke-linecap='round'
                      stroke-linejoin='round'
                      stroke-width='2'
                      d='M19 9l-7 7-7-7'
                    />
                  </svg>
                </span>
              </button>
            </h3>
            <div
              {...api().getItemContentProps({ value: item.value, disabled: item.disabled })}
              class='overflow-hidden transition-all duration-200 data-[state=closed]:animate-collapse data-[state=open]:animate-expand'
            >
              <div class='px-4 py-3 text-sm text-gray-600'>{item.content}</div>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

export default Accordion;
