/**
 * Accordion component using Ark UI
 */

import { Accordion } from '@ark-ui/solid/accordion';
import { For, splitProps } from 'solid-js';

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
export default function AccordionComponent(props) {
  const [local, machineProps] = splitProps(props, ['items', 'class']);

  const handleValueChange = details => {
    if (machineProps.onValueChange) {
      machineProps.onValueChange(details);
    }
  };

  return (
    <Accordion.Root
      value={machineProps.value}
      defaultValue={machineProps.defaultValue}
      onValueChange={handleValueChange}
      multiple={machineProps.multiple}
      collapsible={machineProps.collapsible ?? true}
      disabled={machineProps.disabled}
      orientation={machineProps.orientation || 'vertical'}
      class={`divide-y divide-gray-200 rounded-lg border border-gray-200 ${local.class || ''}`}
    >
      <For each={local.items}>
        {item => (
          <Accordion.Item value={item.value} disabled={item.disabled}>
            <h3>
              <Accordion.ItemTrigger class='flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'>
                <span>{item.title}</span>
                <Accordion.ItemIndicator class='ml-2 transition-transform duration-200 data-[state=open]:rotate-180'>
                  <svg class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                    <path
                      stroke-linecap='round'
                      stroke-linejoin='round'
                      stroke-width='2'
                      d='M19 9l-7 7-7-7'
                    />
                  </svg>
                </Accordion.ItemIndicator>
              </Accordion.ItemTrigger>
            </h3>
            <Accordion.ItemContent class='data-[state=closed]:animate-collapse data-[state=open]:animate-expand overflow-hidden transition-all duration-200'>
              <div class='px-4 py-3 text-sm text-gray-600'>{item.content}</div>
            </Accordion.ItemContent>
          </Accordion.Item>
        )}
      </For>
    </Accordion.Root>
  );
}

export { AccordionComponent as Accordion };
