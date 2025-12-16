import * as tagsInput from '@zag-js/tags-input';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId, For, splitProps, mergeProps } from 'solid-js';
import { FiX } from 'solid-icons/fi';

/**
 * TagsInput - Input for multiple tag values
 *
 * Props:
 * - label: string - Input label
 * - placeholder: string - Input placeholder (default: 'Add tag...')
 * - value: string[] - Controlled tag values
 * - defaultValue: string[] - Initial tag values
 * - onValueChange: (details: { value: string[] }) => void - Callback when tags change
 * - max: number - Maximum number of tags
 * - allowDuplicates: boolean - Allow duplicate tags (default: false)
 * - disabled: boolean - Disable the input
 * - readOnly: boolean - Make input read-only
 * - invalid: boolean - Mark as invalid
 * - name: string - Form field name
 * - blurBehavior: 'add' | 'clear' - What to do with input on blur
 * - addOnPaste: boolean - Add tags when pasting (default: true)
 * - editable: boolean - Allow editing tags (default: true)
 * - class: string - Additional class for root element
 * - inputClass: string - Additional class for input element
 */
export function TagsInput(props) {
  const [local, machineProps] = splitProps(props, [
    'label',
    'placeholder',
    'allowDuplicates',
    'class',
    'inputClass',
  ]);

  const validate = details => {
    if (local.allowDuplicates) return true;
    return !details.values.includes(details.inputValue);
  };

  const context = mergeProps(machineProps, {
    id: createUniqueId(),
    addOnPaste: true,
    editable: true,
    validate,
  });

  const service = useMachine(tagsInput.machine, context);

  const api = createMemo(() => tagsInput.connect(service, normalizeProps));

  return (
    <div {...api().getRootProps()} class={`w-full ${local.class || ''}`}>
      {local.label && (
        <label {...api().getLabelProps()} class='block text-sm font-medium text-gray-700 mb-1'>
          {local.label}
        </label>
      )}
      <div
        {...api().getControlProps()}
        class={`flex flex-wrap gap-1.5 p-2 border rounded-lg transition-colors
          border-gray-300 bg-white
          data-focus:border-blue-500 data-focus:ring-1 data-focus:ring-blue-500
          data-invalid:border-red-500 data-invalid:ring-red-500
          data-disabled:bg-gray-100 data-disabled:cursor-not-allowed
          data-readonly:bg-gray-50`}
      >
        <For each={api().value}>
          {(value, index) => (
            <span
              {...api().getItemProps({ index: index(), value })}
              class='inline-flex items-center'
            >
              <div
                {...api().getItemPreviewProps({ index: index(), value })}
                class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-sm
                  bg-gray-100 text-gray-800
                  data-highlighted:bg-blue-100 data-highlighted:text-blue-800
                  data-disabled:opacity-50`}
              >
                <span {...api().getItemTextProps({ index: index(), value })}>{value}</span>
                <button
                  {...api().getItemDeleteTriggerProps({ index: index(), value })}
                  class='p-0.5 rounded hover:bg-gray-200 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500'
                >
                  <FiX class='w-3 h-3' />
                </button>
              </div>
              <input {...api().getItemInputProps({ index: index(), value })} class='sr-only' />
            </span>
          )}
        </For>
        <input
          {...api().getInputProps()}
          placeholder={local.placeholder || 'Add tag...'}
          class={`flex-1 min-w-30 outline-none text-sm placeholder:text-gray-400 disabled:cursor-not-allowed bg-transparent ${local.inputClass || ''}`}
        />
      </div>
      <input {...api().getHiddenInputProps()} />
    </div>
  );
}

export default TagsInput;
