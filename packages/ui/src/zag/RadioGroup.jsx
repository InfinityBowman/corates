/**
 * RadioGroup - Radio button group for single selection using Ark UI
 */

import { RadioGroup } from '@ark-ui/solid/radio-group';
import { For, splitProps, createMemo } from 'solid-js';

/**
 * RadioGroup - Radio button group for single selection
 *
 * Props:
 * - items: Array<{ value: string, label: string, description?: string, disabled?: boolean }> - Radio items
 * - label: string - Group label
 * - value: string - Controlled selected value
 * - defaultValue: string - Initial selected value
 * - onValueChange: (details: { value: string }) => void - Callback when selection changes
 * - name: string - Form field name
 * - disabled: boolean - Disable all items
 * - orientation: 'horizontal' | 'vertical' - Layout orientation (default: 'vertical')
 * - class: string - Additional class for root element
 */
export function RadioGroupComponent(props) {
  const [local, machineProps] = splitProps(props, ['items', 'label', 'class']);

  const orientation = () => machineProps.orientation || 'vertical';
  const isVertical = createMemo(() => orientation() === 'vertical');

  const handleValueChange = (details) => {
    if (machineProps.onValueChange) {
      machineProps.onValueChange(details);
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
}

export { RadioGroupComponent as RadioGroup };
export default RadioGroupComponent;
