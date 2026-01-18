/**
 * PinInput component for verification codes.
 *
 * @example
 * // Basic 6-digit OTP input
 * <PinInput otp onValueComplete={details => handleCode(details.valueAsString)}>
 *   <PinInputLabel>Verification Code</PinInputLabel>
 *   <PinInputControl>
 *     <Index each={[0, 1, 2, 3, 4, 5]}>
 *       {index => <PinInputField index={index()} />}
 *     </Index>
 *   </PinInputControl>
 *   <PinInputHiddenInput />
 * </PinInput>
 *
 * @example
 * // With error state
 * <PinInput invalid={hasError()}>
 *   <PinInputControl>
 *     <Index each={[0, 1, 2, 3]}>
 *       {index => <PinInputField index={index()} />}
 *     </Index>
 *   </PinInputControl>
 * </PinInput>
 */
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { PinInput as PinInputPrimitive } from '@ark-ui/solid/pin-input';
import type {
  PinInputRootProps as ArkPinInputRootProps,
  PinInputControlProps as ArkPinInputControlProps,
  PinInputInputProps as ArkPinInputInputProps,
  PinInputLabelProps as ArkPinInputLabelProps,
} from '@ark-ui/solid/pin-input';
import { cn } from './cn';

// Re-export primitives directly
const PinInputHiddenInput = PinInputPrimitive.HiddenInput;
const PinInputContext = PinInputPrimitive.Context;

type PinInputProps = ArkPinInputRootProps & {
  class?: string;
  children?: JSX.Element;
};

const PinInput: Component<PinInputProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <PinInputPrimitive.Root class={cn('w-full', local.class)} {...others}>
      {local.children}
    </PinInputPrimitive.Root>
  );
};

type PinInputLabelProps = ArkPinInputLabelProps & {
  class?: string;
  children?: JSX.Element;
};

const PinInputLabel: Component<PinInputLabelProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <PinInputPrimitive.Label
      class={cn('mb-2 block text-sm font-medium text-gray-700', local.class)}
      {...others}
    >
      {local.children}
    </PinInputPrimitive.Label>
  );
};

type PinInputControlProps = ArkPinInputControlProps & {
  class?: string;
  children?: JSX.Element;
};

const PinInputControl: Component<PinInputControlProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <PinInputPrimitive.Control
      class={cn('flex items-center justify-center gap-2', local.class)}
      {...others}
    >
      {local.children}
    </PinInputPrimitive.Control>
  );
};

type PinInputFieldProps = ArkPinInputInputProps & {
  class?: string;
};

const PinInputField: Component<PinInputFieldProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <PinInputPrimitive.Input
      class={cn(
        'h-12 w-12 rounded-lg border border-gray-300 text-center text-lg font-semibold transition',
        'focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none',
        'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
        'data-invalid:border-red-500 data-invalid:focus:ring-red-500',
        local.class,
      )}
      {...others}
    />
  );
};

export {
  PinInput,
  PinInputLabel,
  PinInputControl,
  PinInputField,
  PinInputHiddenInput,
  PinInputContext,
};
