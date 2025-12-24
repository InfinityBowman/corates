/**
 * Switch component using Ark UI
 *
 * Supports both high-level convenience API and low-level composition API
 */

import { Switch as ArkSwitch, useSwitch } from '@ark-ui/solid/switch';
import { mergeProps, splitProps } from 'solid-js';

/**
 * Switch - Full description
 *
 * Props:
 * - checked: boolean - Controlled checked state
 * - defaultChecked: boolean - Default checked state (uncontrolled)
 * - disabled: boolean - Whether switch is disabled
 * - name: string - Name for form submission
 * - onChange: Function - Callback when checked state changes: (checked: boolean) => void
 * - class: string - Additional CSS classes
 */
export default function SwitchComponent(props) {
  const merged = mergeProps(
    {
      defaultChecked: false,
    },
    props,
  );

  const [local, machineProps] = splitProps(merged, ['class', 'onChange']);

  const classValue = () => local.class;
  const onChange = () => local.onChange;

  const checked = () => machineProps.checked;
  const defaultChecked = () => machineProps.defaultChecked;
  const disabled = () => machineProps.disabled;
  const name = () => machineProps.name;

  const handleCheckedChange = details => {
    if (onChange()) {
      onChange()(details.checked === true);
    }
    if (machineProps.onCheckedChange) {
      machineProps.onCheckedChange(details);
    }
  };

  return (
    <ArkSwitch.Root
      {...machineProps}
      checked={checked()}
      defaultChecked={defaultChecked()}
      disabled={disabled()}
      name={name()}
      onCheckedChange={handleCheckedChange}
      class={`inline-flex cursor-pointer items-center ${disabled() ? 'cursor-not-allowed' : ''} ${
        classValue() || ''
      }`}
    >
      <ArkSwitch.HiddenInput />
      <ArkSwitch.Control class='relative inline-flex h-6 w-11 items-center rounded-full transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-200'>
        <ArkSwitch.Thumb class='inline-block h-4 w-4 transform rounded-full bg-white transition-transform data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-1' />
      </ArkSwitch.Control>
    </ArkSwitch.Root>
  );
}

export { SwitchComponent as Switch };
// Export hook for programmatic control
export { useSwitch };
