/**
 * Checkbox component using Ark UI
 */

import { Checkbox } from '@ark-ui/solid/checkbox';
import { mergeProps, Show, createMemo } from 'solid-js';
import { BiRegularCheck, BiRegularMinus } from 'solid-icons/bi';

/**
 * @param {Object} props
 * @param {boolean} [props.checked] - Controlled checked state
 * @param {boolean} [props.defaultChecked] - Default checked state (uncontrolled)
 * @param {boolean} [props.indeterminate] - Whether checkbox is in indeterminate state
 * @param {boolean} [props.disabled] - Whether checkbox is disabled
 * @param {string} [props.name] - Name for form submission
 * @param {string} [props.value] - Value for form submission
 * @param {string} [props.label] - Label text
 * @param {Function} [props.onChange] - Callback when checked state changes: (checked: boolean) => void
 * @param {string} [props.class] - Additional CSS classes
 */
export function CheckboxComponent(props) {
  const merged = mergeProps(
    {
      defaultChecked: false,
    },
    props,
  );

  const checked = () => merged.checked;
  const indeterminate = () => merged.indeterminate;
  const defaultChecked = () => merged.defaultChecked;
  const disabled = () => merged.disabled;
  const name = () => merged.name;
  const value = () => merged.value || 'on';
  const classValue = () => merged.class;
  const label = () => merged.label;

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

  const handleCheckedChange = details => {
    if (merged.onChange) {
      // When transitioning from indeterminate, treat it as checking
      const newChecked = details.checked === true || details.checked === 'indeterminate';
      merged.onChange(newChecked);
    }
  };

  return (
    <Checkbox.Root
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
      <Checkbox.Control class='flex h-4 w-4 items-center justify-center rounded border-2 transition-colors data-[focus]:ring-2 data-[focus]:ring-blue-500 data-[focus]:ring-offset-1 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=indeterminate]:border-blue-600 data-[state=indeterminate]:bg-blue-600 data-[state=unchecked]:border-gray-300 data-[state=unchecked]:bg-white data-[state=unchecked]:hover:border-blue-400'>
        <Checkbox.Indicator indeterminate class='h-3 w-3 text-white'>
          <BiRegularMinus class='h-3 w-3 text-white' />
        </Checkbox.Indicator>
        <Checkbox.Indicator class='h-3 w-3 text-white'>
          <BiRegularCheck class='h-3 w-3 text-white' />
        </Checkbox.Indicator>
      </Checkbox.Control>
      <Checkbox.HiddenInput />
      <Show when={label()}>
        <Checkbox.Label class='text-sm text-gray-700'>{label()}</Checkbox.Label>
      </Show>
    </Checkbox.Root>
  );
}

export { CheckboxComponent as Checkbox };
export default CheckboxComponent;
