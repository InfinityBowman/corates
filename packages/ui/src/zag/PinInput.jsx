/**
 * PinInput component using Ark UI
 */

import { PinInput } from '@ark-ui/solid/pin-input';
import { mergeProps, Index } from 'solid-js';

/**
 * PinInput - OTP/PIN code input
 *
 * Props:
 * - required: boolean - Whether input is required (default: true)
 * - otp: boolean - Whether to use OTP mode (default: true)
 * - autoComplete: string - Autocomplete attribute (default: 'one-time-code')
 * - isError: boolean - Whether to show error state
 * - onInput: (value: string) => void - Callback when value changes
 * - onComplete: (value: string) => void - Callback when all inputs are filled
 */
export default function PinInputComponent(props) {
  const merged = mergeProps(
    {
      required: true,
      otp: true,
      autoComplete: 'one-time-code',
    },
    props,
  );

  const required = () => merged.required;
  const otp = () => merged.otp;
  const autoComplete = () => merged.autoComplete;
  const isError = () => merged.isError;

  const handleValueChange = details => {
    if (merged.onInput) {
      merged.onInput(details.valueAsString);
    }
  };

  const handleValueComplete = details => {
    if (merged.onComplete) {
      merged.onComplete(details.valueAsString);
    }
  };

  const inputClass = () =>
    'w-10 h-12 sm:w-14 sm:h-14 rounded-lg border-2 ' +
    (isError() ?
      'border-red-500 focus:border-red-600 focus:ring-red-400'
    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-400') +
    ' bg-gray-50 text-center text-xl font-semibold outline-none';

  return (
    <div class='flex flex-col items-center'>
      <PinInput.Root
        required={required()}
        otp={otp()}
        onValueChange={handleValueChange}
        onValueComplete={handleValueComplete}
        class='my-6 flex justify-center gap-1 sm:gap-3'
        invalid={isError()}
      >
        <PinInput.HiddenInput />
        <Index each={[0, 1, 2, 3, 4, 5]}>
          {(_, index) => (
            <PinInput.Input index={index()} required={required()} class={inputClass()} />
          )}
        </Index>
      </PinInput.Root>
    </div>
  );
}

export { PinInputComponent as PinInput };
