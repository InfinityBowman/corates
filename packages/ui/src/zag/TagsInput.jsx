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
        <label {...api().getLabelProps()} class='mb-1 block text-sm font-medium text-gray-700'>
          {local.label}
        </label>
      )}
      <div
        {...api().getControlProps()}
        class={`flex flex-wrap gap-1.5 rounded-lg border border-gray-300 bg-white p-2 transition-colors data-disabled:cursor-not-allowed data-disabled:bg-gray-100 data-focus:border-blue-500 data-focus:ring-1 data-focus:ring-blue-500 data-invalid:border-red-500 data-invalid:ring-red-500 data-readonly:bg-gray-50`}
      >
        <For each={api().value}>
          {(value, index) => (
            <span
              {...api().getItemProps({ index: index(), value })}
              class='inline-flex items-center'
            >
              <div
                {...api().getItemPreviewProps({ index: index(), value })}
                class={`inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-sm text-gray-800 data-disabled:opacity-50 data-highlighted:bg-blue-100 data-highlighted:text-blue-800`}
              >
                <span {...api().getItemTextProps({ index: index(), value })}>{value}</span>
                <button
                  {...api().getItemDeleteTriggerProps({ index: index(), value })}
                  class='rounded p-0.5 transition-colors hover:bg-gray-200 focus:ring-1 focus:ring-blue-500 focus:outline-none'
                >
                  <FiX class='h-3 w-3' />
                </button>
              </div>
              <input {...api().getItemInputProps({ index: index(), value })} class='sr-only' />
            </span>
          )}
        </For>
        <input
          {...api().getInputProps()}
          placeholder={local.placeholder || 'Add tag...'}
          class={`min-w-30 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 disabled:cursor-not-allowed ${local.inputClass || ''}`}
        />
      </div>
      <input {...api().getHiddenInputProps()} />
    </div>
  );
}

export default TagsInput;
