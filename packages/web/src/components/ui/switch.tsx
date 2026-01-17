/**
 * Switch component for toggle inputs.
 *
 * @example
 * <SwitchRoot>
 *   <SwitchControl>
 *     <SwitchThumb />
 *   </SwitchControl>
 *   <SwitchLabel>Enable notifications</SwitchLabel>
 *   <SwitchHiddenInput />
 * </SwitchRoot>
 *
 * @example
 * // Controlled
 * const [enabled, setEnabled] = createSignal(false);
 * <SwitchRoot
 *   checked={enabled()}
 *   onCheckedChange={details => setEnabled(details.checked)}
 * >
 *   <SwitchControl>
 *     <SwitchThumb />
 *   </SwitchControl>
 *   <SwitchLabel>Dark mode</SwitchLabel>
 * </SwitchRoot>
 */
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { Switch as SwitchPrimitive } from '@ark-ui/solid/switch';
import type {
  SwitchRootProps as ArkSwitchRootProps,
  SwitchControlProps as ArkSwitchControlProps,
  SwitchThumbProps as ArkSwitchThumbProps,
  SwitchLabelProps as ArkSwitchLabelProps,
} from '@ark-ui/solid/switch';
import { cn } from './cn';

const Switch = SwitchPrimitive.Root;
const SwitchHiddenInput = SwitchPrimitive.HiddenInput;

type SwitchRootProps = ArkSwitchRootProps & {
  class?: string;
  children?: JSX.Element;
};

const SwitchRoot: Component<SwitchRootProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <SwitchPrimitive.Root class={cn('flex items-center gap-2', local.class)} {...others}>
      {local.children}
    </SwitchPrimitive.Root>
  );
};

type SwitchControlProps = ArkSwitchControlProps & {
  class?: string;
  children?: JSX.Element;
};

const SwitchControl: Component<SwitchControlProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <SwitchPrimitive.Control
      class={cn(
        'inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
        'transition-colors',
        'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'bg-gray-200 data-[state=checked]:bg-blue-600',
        local.class,
      )}
      {...others}
    >
      {local.children}
    </SwitchPrimitive.Control>
  );
};

type SwitchThumbProps = ArkSwitchThumbProps & {
  class?: string;
};

const SwitchThumb: Component<SwitchThumbProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <SwitchPrimitive.Thumb
      class={cn(
        'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
        'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
        local.class,
      )}
      {...others}
    />
  );
};

type SwitchLabelProps = ArkSwitchLabelProps & {
  class?: string;
};

const SwitchLabel: Component<SwitchLabelProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <SwitchPrimitive.Label
      class={cn('text-sm leading-none font-medium text-gray-900', local.class)}
      {...others}
    />
  );
};

export { Switch, SwitchRoot, SwitchControl, SwitchThumb, SwitchLabel, SwitchHiddenInput };
