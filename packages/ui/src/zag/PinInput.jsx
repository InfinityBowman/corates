/**
 * PinInput component using Ark UI
 */

import { PinInput } from '@ark-ui/solid/pin-input';
import { splitProps, Index, createMemo, mergeProps } from 'solid-js';

/**
 * PinInput - OTP/PIN code input
 *
 * Props:
 * - count: number - Number of input fields (default: 6)
 * - isError: boolean - Whether to show error state
 * - onInput: (value: string) => void - Callback when value changes
 * - onComplete: (value: string) => void - Callback when all inputs are filled
 * - class: string - Additional class for root element
 * - required: boolean - Whether input is required (default: true)
 * - otp: boolean - Whether to use OTP mode (default: true)
 * - All other props are passed to PinInput.Root
 */
export default function PinInputComponent(props) {
  const [local, machineProps] = splitProps(props, [
    'count',
    'isError',
    'onInput',
    'onComplete',
    'class',
  ]);

  const mergedMachineProps = mergeProps(
    {
      required: true,
      otp: true,
    },
    machineProps,
  );

  const count = () => local.count ?? 6;
  const isError = () => local.isError;
  const classValue = () => local.class;

  const handleValueChange = details => {
    if (local.onInput) {
      local.onInput(details.valueAsString);
    }
  };

  const handleValueComplete = details => {
    if (local.onComplete) {
      local.onComplete(details.valueAsString);
    }
  };

  const inputIndices = createMemo(() => Array.from({ length: count() }, (_, i) => i));

  const inputClass = () =>
    'w-10 h-12 sm:w-14 sm:h-14 rounded-lg border-2 ' +
    (isError() ?
      'border-red-500 focus:border-red-600 focus:ring-red-400'
    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-400') +
    ' bg-gray-50 text-center text-xl font-semibold outline-none';

  return (
    <div class={`flex flex-col items-center ${classValue() || ''}`}>
      <PinInput.Root
        {...mergedMachineProps}
        count={count()}
        onValueChange={handleValueChange}
        onValueComplete={handleValueComplete}
        invalid={isError()}
        class='my-6 flex justify-center gap-1 sm:gap-3'
      >
        <PinInput.HiddenInput />
        <PinInput.Control>
          <Index each={inputIndices()}>
            {item => <PinInput.Input index={item()} class={inputClass()} />}
          </Index>
        </PinInput.Control>
      </PinInput.Root>
    </div>
  );
}

export { PinInputComponent as PinInput };
