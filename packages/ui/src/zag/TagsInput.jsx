/**
 * TagsInput - Input for multiple tag values using Ark UI
 */

import { TagsInput } from '@ark-ui/solid/tags-input';
import { splitProps, mergeProps, Index } from 'solid-js';
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
export default function TagsInputComponent(props) {
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
    addOnPaste: true,
    editable: true,
    validate,
  });

  const handleValueChange = details => {
    if (context.onValueChange) {
      context.onValueChange(details);
    }
  };

  return (
    <TagsInput.Root
      value={context.value}
      defaultValue={context.defaultValue}
      onValueChange={handleValueChange}
      max={context.max}
      disabled={context.disabled}
      readOnly={context.readOnly}
      invalid={context.invalid}
      name={context.name}
      blurBehavior={context.blurBehavior}
      addOnPaste={context.addOnPaste}
      editable={context.editable}
      class={`w-full ${local.class || ''}`}
    >
      <TagsInput.Context>
        {api => (
          <>
            {local.label && (
              <TagsInput.Label class='mb-1 block text-sm font-medium text-gray-700'>
                {local.label}
              </TagsInput.Label>
            )}
            <TagsInput.Control class='flex flex-wrap gap-1.5 rounded-lg border border-gray-300 bg-white p-2 transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:bg-gray-100 data-[focus]:border-blue-500 data-[focus]:ring-1 data-[focus]:ring-blue-500 data-[invalid]:border-red-500 data-[invalid]:ring-red-500 data-[readonly]:bg-gray-50'>
              <Index each={api().value}>
                {(value, index) => (
                  <TagsInput.Item index={index} value={value()} class='inline-flex items-center'>
                    <TagsInput.ItemPreview class='inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-sm text-gray-800 data-[disabled]:opacity-50 data-[highlighted]:bg-blue-100 data-[highlighted]:text-blue-800'>
                      <TagsInput.ItemText>{value()}</TagsInput.ItemText>
                      <TagsInput.ItemDeleteTrigger class='rounded p-0.5 transition-colors hover:bg-gray-200 focus:ring-1 focus:ring-blue-500 focus:outline-none'>
                        <FiX class='h-3 w-3' />
                      </TagsInput.ItemDeleteTrigger>
                    </TagsInput.ItemPreview>
                    <TagsInput.ItemInput class='sr-only' />
                  </TagsInput.Item>
                )}
              </Index>
              <TagsInput.Input
                placeholder={local.placeholder || 'Add tag...'}
                class={`min-w-30 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 disabled:cursor-not-allowed ${local.inputClass || ''}`}
              />
            </TagsInput.Control>
          </>
        )}
      </TagsInput.Context>
      <TagsInput.HiddenInput />
    </TagsInput.Root>
  );
}

export { TagsInputComponent as TagsInput };
