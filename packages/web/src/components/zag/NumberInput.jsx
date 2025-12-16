import * as numberInput from '@zag-js/number-input';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId, Show, splitProps, mergeProps } from 'solid-js';
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
export function NumberInput(props) {
  const [local, machineProps] = splitProps(props, [
    'label',
    'placeholder',
    'showControls',
    'size',
    'class',
    'inputClass',
  ]);

  const context = mergeProps(machineProps, {
    id: createUniqueId(),
    clampValueOnBlur: true,
    spinOnPress: true,
  });

  const service = useMachine(numberInput.machine, context);

  const api = createMemo(() => numberInput.connect(service, normalizeProps));

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
    <div {...api().getRootProps()} class={`w-full ${local.class || ''}`}>
      <Show when={local.label}>
        <label {...api().getLabelProps()} class='block text-sm font-medium text-gray-700 mb-1'>
          {local.label}
        </label>
      </Show>
      <div class='flex'>
        <Show when={showControls()}>
          <button
            {...api().getDecrementTriggerProps()}
            class={`${sizes().button} border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 text-gray-600
              hover:bg-gray-100 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset`}
          >
            <FiMinus class='w-4 h-4' />
          </button>
        </Show>
        <input
          {...api().getInputProps()}
          placeholder={local.placeholder}
          class={`${sizes().input} flex-1 border border-gray-300 text-center
            ${showControls() ? '' : 'rounded-lg'}
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            data-invalid:border-red-500 data-invalid:ring-red-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            read-only:bg-gray-50
            ${local.inputClass || ''}`}
        />
        <Show when={showControls()}>
          <button
            {...api().getIncrementTriggerProps()}
            class={`${sizes().button} border border-l-0 border-gray-300 rounded-r-lg bg-gray-50 text-gray-600
              hover:bg-gray-100 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset`}
          >
            <FiPlus class='w-4 h-4' />
          </button>
        </Show>
      </div>
    </div>
  );
}

export default NumberInput;
