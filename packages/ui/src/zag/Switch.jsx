import * as zagSwitch from '@zag-js/switch';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId, mergeProps } from 'solid-js';

export default function Switch(props) {
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

  const service = useMachine(zagSwitch.machine, () => ({
    id: createUniqueId(),
    checked: checked(),
    defaultChecked: defaultChecked(),
    disabled: disabled(),
    name: name(),
    onCheckedChange(details) {
      merged.onChange?.(details.checked);
    },
  }));
  const api = createMemo(() => zagSwitch.connect(service, normalizeProps));

  return (
    <label
      {...api().getRootProps()}
      class={`inline-flex cursor-pointer items-center ${disabled() ? 'cursor-not-allowed' : ''} ${
        classValue() || ''
      }`}
    >
      <input {...api().getHiddenInputProps()} />
      <span
        {...api().getControlProps()}
        class='relative inline-flex h-6 w-11 items-center rounded-full transition-colors data-disabled:cursor-not-allowed data-disabled:opacity-50 data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-200'
      >
        <span
          {...api().getThumbProps()}
          class='inline-block h-4 w-4 transform rounded-full bg-white transition-transform data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-1'
        />
      </span>
    </label>
  );
}
