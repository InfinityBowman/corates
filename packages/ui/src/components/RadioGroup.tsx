/**
 * RadioGroup - Radio button group for single selection using Ark UI
 */

import { RadioGroup } from '@ark-ui/solid/radio-group';
import { Component, For, splitProps, createMemo } from 'solid-js';

export interface RadioGroupItem {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  /** Radio items */
  items: RadioGroupItem[];
  /** Group label */
  label?: string;
  /** Controlled selected value */
  value?: string;
  /** Initial selected value */
  defaultValue?: string;
  /** Callback when selection changes */
  onValueChange?: (_details: { value: string }) => void;
  /** Form field name */
  name?: string;
  /** Disable all items */
  disabled?: boolean;
  /** Layout orientation (default: 'vertical') */
  orientation?: 'horizontal' | 'vertical';
  /** Additional class for root element */
  class?: string;
}

/**
 * RadioGroup - Radio button group for single selection
 */
const RadioGroupComponent: Component<RadioGroupProps> = props => {
  const [local, machineProps] = splitProps(props, ['items', 'label', 'class']);

  const orientation = () => machineProps.orientation || 'vertical';
  const isVertical = createMemo(() => orientation() === 'vertical');

  const handleValueChange = (details: { value: string | null }) => {
    if (machineProps.onValueChange && details.value !== null) {
      machineProps.onValueChange({ value: details.value });
    }
  };

  return (
    <RadioGroup.Root
      value={machineProps.value}
      defaultValue={machineProps.defaultValue}
      onValueChange={handleValueChange}
      name={machineProps.name}
      disabled={machineProps.disabled}
      orientation={orientation()}
      class={local.class || ''}
    >
      <RadioGroup.Label class='mb-2 block text-sm font-medium text-gray-700'>
        {local.label}
      </RadioGroup.Label>
      <div class={`flex gap-3 ${isVertical() ? 'flex-col' : 'flex-row flex-wrap'}`}>
        <For each={local.items}>
          {item => (
            <RadioGroup.Item
              value={item.value}
              disabled={item.disabled || machineProps.disabled}
              class={`group relative flex cursor-pointer items-start gap-3 ${
                item.disabled || machineProps.disabled ? 'cursor-not-allowed opacity-50' : ''
              }`}
            >
              <div class='flex h-5 items-center'>
                <RadioGroup.ItemHiddenInput />
                <RadioGroup.ItemControl class='flex h-4 w-4 items-center justify-center rounded-full border-2 border-gray-300 transition-colors group-hover:border-gray-400 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[focus]:ring-2 data-[focus]:ring-blue-500 data-[focus]:ring-offset-2 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:group-hover:border-blue-600'>
                  <div class='h-1.5 w-1.5 scale-0 rounded-full bg-white transition-transform data-[state=checked]:scale-100' />
                </RadioGroup.ItemControl>
              </div>
              <div class='flex flex-col'>
                <RadioGroup.ItemText class='text-sm font-medium text-gray-900'>
                  {item.label}
                </RadioGroup.ItemText>
                {item.description && <span class='text-xs text-gray-500'>{item.description}</span>}
              </div>
            </RadioGroup.Item>
          )}
        </For>
      </div>
    </RadioGroup.Root>
  );
};

export { RadioGroupComponent as RadioGroup };

// Export raw Ark UI primitive for custom layouts
export { RadioGroup as RadioGroupPrimitive };
