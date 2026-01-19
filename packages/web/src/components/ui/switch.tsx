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
 *   onCheckedChange={setEnabled}
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

type SwitchRootProps = Omit<ArkSwitchRootProps, 'onCheckedChange'> & {
  class?: string;
  children?: JSX.Element;
  onCheckedChange?: (_checked: boolean) => void;
};

const SwitchRoot: Component<SwitchRootProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children', 'onCheckedChange']);
  return (
    <SwitchPrimitive.Root
      class={cn('flex items-center gap-2', local.class)}
      onCheckedChange={details => local.onCheckedChange?.(details.checked)}
      {...others}
    >
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
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        'data-disabled:cursor-not-allowed data-disabled:opacity-50',
        'bg-input data-[state=checked]:bg-primary',
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
        'bg-card pointer-events-none block h-5 w-5 rounded-full shadow-lg ring-0 transition-transform',
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
      class={cn('text-foreground text-sm leading-none font-medium', local.class)}
      {...others}
    />
  );
};

export { Switch, SwitchRoot, SwitchControl, SwitchThumb, SwitchLabel, SwitchHiddenInput };
