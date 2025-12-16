/**
 * Checkbox component using Zag.js
 */

import * as checkbox from '@zag-js/checkbox';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId, mergeProps, Show } from 'solid-js';
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
export function Checkbox(props) {
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
  const value = () => merged.value;
  const classValue = () => merged.class;
  const label = () => merged.label;

  const service = useMachine(checkbox.machine, () => ({
    id: createUniqueId(),
    checked: indeterminate() ? 'indeterminate' : checked(),
    defaultChecked: defaultChecked(),
    disabled: disabled(),
    name: name(),
    value: value(),
    onCheckedChange(details) {
      merged.onChange?.(details.checked === true);
    },
  }));

  const api = createMemo(() => checkbox.connect(service, normalizeProps));

  return (
    <label
      {...api().getRootProps()}
      class={`inline-flex items-center gap-2 cursor-pointer select-none ${
        disabled() ? 'opacity-50 cursor-not-allowed' : ''
      } ${classValue() || ''}`}
    >
      <div
        {...api().getControlProps()}
        class={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
          api().checked || api().indeterminate ?
            'bg-blue-600 border-blue-600'
          : 'bg-white border-gray-300 hover:border-blue-400'
        } ${api().focused ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
      >
        <Show when={api().indeterminate}>
          <BiRegularMinus class='w-3 h-3 text-white' />
        </Show>
        <Show when={api().checked && !api().indeterminate}>
          <BiRegularCheck class='w-3 h-3 text-white' />
        </Show>
      </div>
      <input {...api().getHiddenInputProps()} />
      <Show when={label()}>
        <span {...api().getLabelProps()} class='text-sm text-gray-700'>
          {label()}
        </span>
      </Show>
    </label>
  );
}

export default Checkbox;
