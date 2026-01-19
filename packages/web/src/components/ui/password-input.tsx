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
      class={cn('text-secondary-foreground mb-1 block text-sm font-medium', local.class)}
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
    <PasswordInputPrimitive.Control
      class={cn('relative flex items-center', local.class)}
      {...others}
    >
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
        'border-border w-full rounded-lg border px-3 py-2 pr-10 text-sm transition',
        'focus:ring-primary focus:border-transparent focus:ring-2 focus:outline-none',
        'disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed',
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
        'text-muted-foreground/70 absolute right-3 flex items-center transition-colors',
        'hover:text-muted-foreground focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        local.class,
      )}
      {...others}
    >
      {local.children ?? (
        <PasswordInputPrimitive.Indicator fallback={<FiEyeOff class='h-4 w-4' />}>
          <FiEye class='h-4 w-4' />
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
