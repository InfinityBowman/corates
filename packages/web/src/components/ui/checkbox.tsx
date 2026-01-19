/**
 * Checkbox component for boolean inputs.
 *
 * @example
 * <CheckboxRoot>
 *   <CheckboxControl />
 *   <CheckboxLabel>Accept terms and conditions</CheckboxLabel>
 *   <CheckboxHiddenInput />
 * </CheckboxRoot>
 *
 * @example
 * // Controlled
 * const [checked, setChecked] = createSignal(false);
 * <CheckboxRoot
 *   checked={checked()}
 *   onCheckedChange={setChecked}
 * >
 *   <CheckboxControl />
 *   <CheckboxLabel>Remember me</CheckboxLabel>
 * </CheckboxRoot>
 *
 * @example
 * // Indeterminate state (for "select all" patterns)
 * <CheckboxRoot checked="indeterminate">
 *   <CheckboxControl />
 *   <CheckboxLabel>Select all</CheckboxLabel>
 * </CheckboxRoot>
 */
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { Checkbox as CheckboxPrimitive } from '@ark-ui/solid/checkbox';
import type {
  CheckboxRootProps as ArkCheckboxRootProps,
  CheckboxControlProps as ArkCheckboxControlProps,
  CheckboxLabelProps as ArkCheckboxLabelProps,
} from '@ark-ui/solid/checkbox';
import { BiRegularCheck, BiRegularMinus } from 'solid-icons/bi';
import { cn } from './cn';

const Checkbox = CheckboxPrimitive.Root;
const CheckboxHiddenInput = CheckboxPrimitive.HiddenInput;

type CheckedState = boolean | 'indeterminate';

type CheckboxRootProps = Omit<ArkCheckboxRootProps, 'onCheckedChange'> & {
  class?: string;
  children?: JSX.Element;
  onCheckedChange?: (_checked: CheckedState) => void;
};

const CheckboxRoot: Component<CheckboxRootProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children', 'onCheckedChange']);
  return (
    <CheckboxPrimitive.Root
      class={cn('flex items-center gap-2', local.class)}
      onCheckedChange={details => local.onCheckedChange?.(details.checked)}
      {...others}
    >
      {local.children}
    </CheckboxPrimitive.Root>
  );
};

type CheckboxControlProps = ArkCheckboxControlProps & {
  class?: string;
};

const CheckboxControl: Component<CheckboxControlProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <CheckboxPrimitive.Control
      class={cn(
        'border-border flex h-4 w-4 shrink-0 items-center justify-center rounded border',
        'ring-offset-background transition-colors',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        'data-disabled:cursor-not-allowed data-disabled:opacity-50',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        'data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
        local.class,
      )}
      {...others}
    >
      <CheckboxPrimitive.Indicator>
        <BiRegularCheck class='h-3.5 w-3.5' />
      </CheckboxPrimitive.Indicator>
      <CheckboxPrimitive.Indicator indeterminate>
        <BiRegularMinus class='h-3.5 w-3.5' />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Control>
  );
};

type CheckboxLabelProps = ArkCheckboxLabelProps & {
  class?: string;
};

const CheckboxLabel: Component<CheckboxLabelProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <CheckboxPrimitive.Label
      class={cn(
        'text-foreground text-sm leading-none font-medium',
        'data-disabled:cursor-not-allowed data-disabled:opacity-70',
        local.class,
      )}
      {...others}
    />
  );
};

export { Checkbox, CheckboxRoot, CheckboxControl, CheckboxLabel, CheckboxHiddenInput };
