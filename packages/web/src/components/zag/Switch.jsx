import * as zagSwitch from '@zag-js/switch';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId } from 'solid-js';

export default function Switch(props) {
  const service = useMachine(zagSwitch.machine, {
    id: createUniqueId(),
    defaultChecked: props.checked,
    disabled: props.disabled,
    name: props.name,
    onCheckedChange(details) {
      props.onChange?.(details.checked);
    },
  });
  const api = createMemo(() => zagSwitch.connect(service, normalizeProps));

  return (
    <label {...api().getRootProps()} class='inline-flex items-center cursor-pointer'>
      <input {...api().getHiddenInputProps()} />
      <span
        {...api().getControlProps()}
        class='relative inline-flex h-6 w-11 items-center rounded-full transition-colors data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-200 data-disabled:opacity-50 data-disabled:cursor-not-allowed'
      >
        <span
          {...api().getThumbProps()}
          class='inline-block h-4 w-4 transform rounded-full bg-white transition-transform data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-1'
        />
      </span>
    </label>
  );
}
