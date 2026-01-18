/**
 * PasswordInput component with visibility toggle.
 *
 * @example
 * // Basic usage
 * <PasswordInput>
 *   <PasswordInputLabel>Password</PasswordInputLabel>
 *   <PasswordInputControl>
 *     <PasswordInputField />
 *     <PasswordInputVisibilityTrigger />
 *   </PasswordInputControl>
 * </PasswordInput>
 *
 * @example
 * // With controlled value
 * <PasswordInput autoComplete="current-password">
 *   <PasswordInputControl>
 *     <PasswordInputField
 *       value={password()}
 *       onInput={e => setPassword(e.target.value)}
 *     />
 *     <PasswordInputVisibilityTrigger />
 *   </PasswordInputControl>
 * </PasswordInput>
 */
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { PasswordInput as PasswordInputPrimitive } from '@ark-ui/solid/password-input';
import type {
  PasswordInputRootProps as ArkPasswordInputRootProps,
  PasswordInputControlProps as ArkPasswordInputControlProps,
  PasswordInputInputProps as ArkPasswordInputInputProps,
  PasswordInputLabelProps as ArkPasswordInputLabelProps,
  PasswordInputVisibilityTriggerProps as ArkPasswordInputVisibilityTriggerProps,
} from '@ark-ui/solid/password-input';
import { FiEye, FiEyeOff } from 'solid-icons/fi';
import { cn } from './cn';

// Re-export primitives directly
const PasswordInputIndicator = PasswordInputPrimitive.Indicator;
const PasswordInputContext = PasswordInputPrimitive.Context;

type PasswordInputProps = ArkPasswordInputRootProps & {
  class?: string;
  children?: JSX.Element;
};

const PasswordInput: Component<PasswordInputProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <PasswordInputPrimitive.Root class={cn('w-full', local.class)} {...others}>
      {local.children}
    </PasswordInputPrimitive.Root>
  );
};

type PasswordInputLabelProps = ArkPasswordInputLabelProps & {
  class?: string;
  children?: JSX.Element;
};

const PasswordInputLabel: Component<PasswordInputLabelProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <PasswordInputPrimitive.Label
      class={cn('mb-1 block text-sm font-medium text-gray-700', local.class)}
      {...others}
    >
      {local.children}
    </PasswordInputPrimitive.Label>
  );
};

type PasswordInputControlProps = ArkPasswordInputControlProps & {
  class?: string;
  children?: JSX.Element;
};

const PasswordInputControl: Component<PasswordInputControlProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <PasswordInputPrimitive.Control class={cn('relative', local.class)} {...others}>
      {local.children}
    </PasswordInputPrimitive.Control>
  );
};

type PasswordInputFieldProps = ArkPasswordInputInputProps & {
  class?: string;
};

const PasswordInputField: Component<PasswordInputFieldProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <PasswordInputPrimitive.Input
      class={cn(
        'w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm transition',
        'focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none',
        'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
        local.class,
      )}
      {...others}
    />
  );
};

type PasswordInputVisibilityTriggerProps = ArkPasswordInputVisibilityTriggerProps & {
  class?: string;
  children?: JSX.Element;
};

const PasswordInputVisibilityTrigger: Component<PasswordInputVisibilityTriggerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <PasswordInputPrimitive.VisibilityTrigger
      class={cn(
        'absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 transition-colors',
        'hover:text-gray-600 focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        local.class,
      )}
      {...others}
    >
      {local.children ?? (
        <PasswordInputPrimitive.Indicator fallback={<FiEyeOff class='h-5 w-5' />}>
          <FiEye class='h-5 w-5' />
        </PasswordInputPrimitive.Indicator>
      )}
    </PasswordInputPrimitive.VisibilityTrigger>
  );
};

export {
  PasswordInput,
  PasswordInputLabel,
  PasswordInputControl,
  PasswordInputField,
  PasswordInputVisibilityTrigger,
  PasswordInputIndicator,
  PasswordInputContext,
};
