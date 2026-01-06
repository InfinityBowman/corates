/**
 * Checkbox component using Ark UI
 *
 * Supports both high-level convenience API and low-level composition API
 */

import { Checkbox as ArkCheckbox, useCheckbox } from '@ark-ui/solid/checkbox';
import { Component, mergeProps, splitProps, Show, createMemo } from 'solid-js';
import { BiRegularCheck, BiRegularMinus } from 'solid-icons/bi';

export interface CheckboxProps {
  /** Controlled checked state */
  checked?: boolean;
  /** Default checked state (uncontrolled) */
  defaultChecked?: boolean;
  /** Whether checkbox is in indeterminate state */
  indeterminate?: boolean;
  /** Whether checkbox is disabled */
  disabled?: boolean;
  /** Name for form submission */
  name?: string;
  /** Value for form submission */
  value?: string;
  /** Label text */
  label?: string;
  /** Callback when checked state changes */
  onChange?: (_checked: boolean) => void;
  /** Additional CSS classes */
  class?: string;
  /** Callback when checked state changes (Ark UI compatible) */
  onCheckedChange?: (_details: { checked: boolean | 'indeterminate' }) => void;
}

/**
 * Checkbox - Full description
 */
const CheckboxComponent: Component<CheckboxProps> = props => {
  const merged = mergeProps(
    {
      defaultChecked: false,
    },
    props,
  );

  const [local, machineProps] = splitProps(merged, ['label', 'class', 'indeterminate', 'onChange']);

  const label = () => local.label;
  const classValue = () => local.class;
  const indeterminate = () => local.indeterminate;
  const onChange = () => local.onChange;

  const checked = () => machineProps.checked;
  const defaultChecked = () => machineProps.defaultChecked;
  const disabled = () => machineProps.disabled;
  const name = () => machineProps.name;
  const value = () => machineProps.value || 'on';

  // Convert indeterminate to checked state
  const checkedState = createMemo(() => {
    if (indeterminate()) return 'indeterminate';
    if (checked() !== undefined) return checked() === true;
    return undefined;
  });

  const defaultCheckedState = createMemo(() => {
    if (indeterminate()) return 'indeterminate';
    return defaultChecked();
  });

  const handleCheckedChange = (details: { checked: boolean | 'indeterminate' }) => {
    const changeHandler = onChange();
    if (changeHandler) {
      // When transitioning from indeterminate, treat it as checking
      const newChecked = details.checked === true || details.checked === 'indeterminate';
      changeHandler(newChecked);
    }
    if (machineProps.onCheckedChange) {
      machineProps.onCheckedChange(details);
    }
  };

  return (
    <ArkCheckbox.Root
      {...machineProps}
      checked={checkedState()}
      defaultChecked={defaultCheckedState()}
      disabled={disabled()}
      name={name()}
      value={value()}
      onCheckedChange={handleCheckedChange}
      class={`inline-flex cursor-pointer items-center gap-2 select-none ${
        disabled() ? 'cursor-not-allowed opacity-50' : ''
      } ${classValue() || ''}`}
    >
      <ArkCheckbox.Control class='flex h-4 w-4 items-center justify-center rounded border-2 transition-colors data-[focus]:ring-2 data-[focus]:ring-blue-500 data-[focus]:ring-offset-1 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=indeterminate]:border-blue-600 data-[state=indeterminate]:bg-blue-600 data-[state=unchecked]:border-gray-300 data-[state=unchecked]:bg-white data-[state=unchecked]:hover:border-blue-400'>
        <ArkCheckbox.Indicator indeterminate class='h-3 w-3 text-white'>
          <BiRegularMinus class='h-3 w-3 text-white' />
        </ArkCheckbox.Indicator>
        <ArkCheckbox.Indicator class='h-3 w-3 text-white'>
          <BiRegularCheck class='h-3 w-3 text-white' />
        </ArkCheckbox.Indicator>
      </ArkCheckbox.Control>
      <ArkCheckbox.HiddenInput />
      <Show when={label()}>
        <ArkCheckbox.Label class='text-sm text-gray-700'>{label()}</ArkCheckbox.Label>
      </Show>
    </ArkCheckbox.Root>
  );
};

export { CheckboxComponent as Checkbox };

// Export raw Ark UI primitive for custom layouts
export { ArkCheckbox as CheckboxPrimitive };

// Export hook for programmatic control
export { useCheckbox };
