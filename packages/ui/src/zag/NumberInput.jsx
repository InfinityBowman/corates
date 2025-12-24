/**
 * NumberInput - Numeric input with increment/decrement controls using Ark UI
 */

import { NumberInput } from '@ark-ui/solid/number-input';
import { Show, splitProps, mergeProps, createMemo } from 'solid-js';
import { FiMinus, FiPlus } from 'solid-icons/fi';

/**
 * NumberInput - Numeric input with increment/decrement controls
 *
 * Props:
 * - label: string - Input label
 * - value: string - Controlled value (as string for formatting)
 * - defaultValue: string - Initial value
 * - onValueChange: (details: { value: string, valueAsNumber: number }) => void - Callback when value changes
 * - min: number - Minimum value
 * - max: number - Maximum value
 * - step: number - Increment/decrement step (default: 1)
 * - disabled: boolean - Disable the input
 * - readOnly: boolean - Make input read-only
 * - invalid: boolean - Mark as invalid
 * - required: boolean - Mark as required
 * - name: string - Form field name
 * - placeholder: string - Input placeholder
 * - allowMouseWheel: boolean - Allow mouse wheel to change value (default: false)
 * - clampValueOnBlur: boolean - Clamp value to min/max on blur (default: true)
 * - spinOnPress: boolean - Spin on button press and hold (default: true)
 * - formatOptions: Intl.NumberFormatOptions - Number format options
 * - showControls: boolean - Show increment/decrement buttons (default: true)
 * - size: 'sm' | 'md' | 'lg' - Input size (default: 'md')
 * - class: string - Additional class for root element
 * - inputClass: string - Additional class for input element
 */
export function NumberInputComponent(props) {
  const [local, machineProps] = splitProps(props, [
    'label',
    'placeholder',
    'showControls',
    'size',
    'class',
    'inputClass',
  ]);

  const context = mergeProps(machineProps, {
    clampValueOnBlur: true,
    spinOnPress: true,
  });

  const showControls = () => local.showControls !== false;

  const sizes = createMemo(() => {
    switch (local.size) {
      case 'sm':
        return { input: 'px-2 py-1 text-sm', button: 'px-2' };
      case 'lg':
        return { input: 'px-4 py-3 text-lg', button: 'px-3' };
      default:
        return { input: 'px-3 py-2 text-base', button: 'px-2.5' };
    }
  });

  return (
    <NumberInput.Root
      value={context.value}
      defaultValue={context.defaultValue}
      onValueChange={context.onValueChange}
      min={context.min}
      max={context.max}
      step={context.step}
      disabled={context.disabled}
      readOnly={context.readOnly}
      invalid={context.invalid}
      required={context.required}
      name={context.name}
      allowMouseWheel={context.allowMouseWheel}
      clampValueOnBlur={context.clampValueOnBlur}
      spinOnPress={context.spinOnPress}
      formatOptions={context.formatOptions}
      class={`w-full ${local.class || ''}`}
    >
      <Show when={local.label}>
        <NumberInput.Label class='mb-1 block text-sm font-medium text-gray-700'>
          {local.label}
        </NumberInput.Label>
      </Show>
      <div class='flex'>
        <Show when={showControls()}>
          <NumberInput.DecrementTrigger
            class={`${sizes().button} rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-600 transition-colors hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:ring-inset disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <FiMinus class='h-4 w-4' />
          </NumberInput.DecrementTrigger>
        </Show>
        <NumberInput.Input
          placeholder={local.placeholder}
          class={`${sizes().input} flex-1 border border-gray-300 text-center ${showControls() ? '' : 'rounded-lg'} read-only:bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 data-[invalid]:border-red-500 data-[invalid]:ring-red-500 ${local.inputClass || ''}`}
        />
        <Show when={showControls()}>
          <NumberInput.IncrementTrigger
            class={`${sizes().button} rounded-r-lg border border-l-0 border-gray-300 bg-gray-50 text-gray-600 transition-colors hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:ring-inset disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <FiPlus class='h-4 w-4' />
          </NumberInput.IncrementTrigger>
        </Show>
      </div>
    </NumberInput.Root>
  );
}

export { NumberInputComponent as NumberInput };
export default NumberInputComponent;
