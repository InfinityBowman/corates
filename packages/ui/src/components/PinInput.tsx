/**
 * PinInput component using Ark UI
 */

import { PinInput } from '@ark-ui/solid/pin-input';
import { Component, splitProps, Index, createMemo, mergeProps } from 'solid-js';

export interface PinInputProps {
  /** Number of input fields (default: 6) */
  count?: number;
  /** Whether to show error state */
  isError?: boolean;
  /** Callback when value changes */
  onInput?: (value: string) => void;
  /** Callback when all inputs are filled */
  onComplete?: (value: string) => void;
  /** Additional class for root element */
  class?: string;
  /** Whether input is required (default: true) */
  required?: boolean;
  /** Whether to use OTP mode (default: true) */
  otp?: boolean;
  /** Autocomplete attribute (default: 'one-time-code') */
  autoComplete?: string;
}

/**
 * PinInput - OTP/PIN code input
 */
const PinInputComponent: Component<PinInputProps> = props => {
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

  const handleValueChange = (details: { valueAsString: string }) => {
    if (local.onInput) {
      local.onInput(details.valueAsString);
    }
  };

  const handleValueComplete = (details: { valueAsString: string }) => {
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
};

export { PinInputComponent as PinInput };
export default PinInputComponent;
