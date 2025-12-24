/**
 * Switch component using Ark UI
 */

import { Switch } from '@ark-ui/solid/switch';
import { mergeProps } from 'solid-js';

/**
 * @param {Object} props
 * @param {boolean} [props.checked] - Controlled checked state
 * @param {boolean} [props.defaultChecked] - Default checked state (uncontrolled)
 * @param {boolean} [props.disabled] - Whether switch is disabled
 * @param {string} [props.name] - Name for form submission
 * @param {Function} [props.onChange] - Callback when checked state changes: (checked: boolean) => void
 * @param {string} [props.class] - Additional CSS classes
 */
export default function SwitchComponent(props) {
  const merged = mergeProps(
    {
      defaultChecked: false,
    },
    props,
  );

  const checked = () => merged.checked;
  const defaultChecked = () => merged.defaultChecked;
  const disabled = () => merged.disabled;
  const name = () => merged.name;
  const classValue = () => merged.class;

  const handleCheckedChange = (details) => {
    if (merged.onChange) {
      merged.onChange(details.checked === true);
    }
  };

  return (
    <Switch.Root
      checked={checked()}
      defaultChecked={defaultChecked()}
      disabled={disabled()}
      name={name()}
      onCheckedChange={handleCheckedChange}
      class={`inline-flex cursor-pointer items-center ${disabled() ? 'cursor-not-allowed' : ''} ${
        classValue() || ''
      }`}
    >
      <Switch.HiddenInput />
      <Switch.Control class='relative inline-flex h-6 w-11 items-center rounded-full transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-200'>
        <Switch.Thumb class='inline-block h-4 w-4 transform rounded-full bg-white transition-transform data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-1' />
      </Switch.Control>
    </Switch.Root>
  );
}

export { SwitchComponent as Switch };
