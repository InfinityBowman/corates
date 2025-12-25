/**
 * Accordion component using Ark UI
 */

import { Accordion } from '@ark-ui/solid/accordion';
import { Component, For, splitProps, JSX } from 'solid-js';

export interface AccordionItem {
  value: string;
  title: JSX.Element;
  content: JSX.Element;
  disabled?: boolean;
}

export interface AccordionProps {
  /** Accordion items */
  items: AccordionItem[];
  /** Initially expanded items */
  defaultValue?: string[];
  /** Controlled expanded items */
  value?: string[];
  /** Callback when expanded items change */
  onValueChange?: (_details: { value: string[] }) => void;
  /** Allow multiple items expanded (default: false) */
  multiple?: boolean;
  /** Allow collapsing all items (default: true) */
  collapsible?: boolean;
  /** Disable all items */
  disabled?: boolean;
  /** Orientation (default: 'vertical') */
  orientation?: 'horizontal' | 'vertical';
  /** Additional class for root element */
  class?: string;
}

/**
 * Accordion - Vertically stacked expandable sections
 */
const AccordionComponent: Component<AccordionProps> = props => {
  const [local, machineProps] = splitProps(props, ['items', 'class']);

  const handleValueChange = (details: { value: string[] }) => {
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
};

export { AccordionComponent as Accordion };
