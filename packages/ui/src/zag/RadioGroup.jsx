import * as radio from '@zag-js/radio-group';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId, For, splitProps, mergeProps } from 'solid-js';

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
export function RadioGroup(props) {
  const [local, machineProps] = splitProps(props, ['items', 'label', 'class']);

  const context = mergeProps(machineProps, {
    id: createUniqueId(),
    orientation: 'vertical',
  });

  const service = useMachine(radio.machine, context);

  const api = createMemo(() => radio.connect(service, normalizeProps));

  const isVertical = () => context.orientation === 'vertical';

  return (
    <div {...api().getRootProps()} class={local.class || ''}>
      <label {...api().getLabelProps()} class='block text-sm font-medium text-gray-700 mb-2'>
        {local.label}
      </label>
      <div class={`flex gap-3 ${isVertical() ? 'flex-col' : 'flex-row flex-wrap'}`}>
        <For each={local.items}>
          {item => (
            <label
              {...api().getItemProps({ value: item.value, disabled: item.disabled })}
              class={`relative flex items-start gap-3 cursor-pointer group ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div class='flex items-center h-5'>
                <input
                  {...api().getItemHiddenInputProps({ value: item.value, disabled: item.disabled })}
                />
                <div
                  {...api().getItemControlProps({ value: item.value, disabled: item.disabled })}
                  class='w-4 h-4 rounded-full border-2 border-gray-300 transition-colors data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500 group-hover:border-gray-400 data-[state=checked]:group-hover:border-blue-600 data-focus:ring-2 data-focus:ring-blue-500 data-focus:ring-offset-2 data-disabled:opacity-50 data-disabled:cursor-not-allowed flex items-center justify-center'
                >
                  <div
                    class='w-1.5 h-1.5 rounded-full bg-white scale-0 transition-transform data-[state=checked]:scale-100'
                    data-state={api().value === item.value ? 'checked' : 'unchecked'}
                  />
                </div>
              </div>
              <div class='flex flex-col'>
                <span
                  {...api().getItemTextProps({ value: item.value, disabled: item.disabled })}
                  class='text-sm font-medium text-gray-900'
                >
                  {item.label}
                </span>
                {item.description && <span class='text-xs text-gray-500'>{item.description}</span>}
              </div>
            </label>
          )}
        </For>
      </div>
    </div>
  );
}

export default RadioGroup;
