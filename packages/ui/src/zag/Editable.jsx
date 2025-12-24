/**
 * Editable - An inline editable single-line text component using Ark UI
 */

import { Editable } from '@ark-ui/solid/editable';
import { Show, mergeProps } from 'solid-js';
import { FiCheck, FiX, FiEdit2 } from 'solid-icons/fi';
import { cn } from '../lib/cn.js';

/**
 * Variant style presets for common use cases
 * Note: For autoResize to work, input/preview need minimal styles.
 * Visual styles go on the area element which wraps both.
 */
const variants = {
  // Default: form field with padding and focus ring
  default: {
    area: 'px-2 py-1 rounded transition-colors hover:bg-gray-100 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 border border-transparent',
    input: 'outline-none bg-transparent',
    preview: 'cursor-pointer',
  },
  // Inline: minimal styling, no padding, blends into surrounding text
  inline: {
    area: 'border-b border-transparent focus-within:border-blue-500 transition-colors',
    input: 'outline-none bg-transparent',
    preview: 'cursor-pointer hover:text-blue-600 transition-colors',
  },
  // Heading: for titles/headings, larger text, subtle hover
  heading: {
    area: 'rounded transition-colors hover:bg-gray-50 focus-within:bg-gray-50',
    input: 'outline-none bg-transparent',
    preview: 'cursor-pointer',
  },
  // Field: more prominent form field with visible border
  field: {
    area: 'px-3 py-2 border border-gray-300 rounded-md transition-colors hover:border-gray-400 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500',
    input: 'outline-none bg-transparent',
    preview: 'cursor-pointer',
  },
};

/**
 * Editable - An inline editable single-line text component using Ark UI
 *
 * Best for: titles, names, labels - single line text that can be edited inline.
 * For multi-line text (descriptions, notes), use a manual textarea approach instead.
 *
 * Props:
 * - value: string - The controlled value
 * - defaultValue: string - The initial value (uncontrolled)
 * - placeholder: string - Placeholder text when empty
 * - onChange: (value: string) => void - Called when value changes (on each keystroke)
 * - onSubmit: (value: string) => void - Called when value is committed (Enter/blur/submit button)
 * - onCancel: () => void - Called when editing is cancelled
 * - disabled: boolean - Whether the editable is disabled
 * - readOnly: boolean - Whether the editable is read-only (can view but not edit)
 * - autoResize: boolean - Whether to auto-resize to fit content
 * - activationMode: 'focus' | 'dblclick' | 'click' | 'none' - How to enter edit mode (default: 'dblclick')
 * - submitMode: 'enter' | 'blur' | 'none' | 'both' - What triggers submit (default: 'both')
 * - selectOnFocus: boolean - Whether to select text when focused
 * - maxLength: number - Maximum characters allowed
 * - variant: 'default' | 'inline' | 'heading' | 'field' - Style preset (default: 'default')
 * - class: string - Additional CSS classes for the root
 * - areaClass: string - Additional CSS classes for the area (input/preview container)
 * - inputClass: string - Additional CSS classes for the input (merged with variant)
 * - previewClass: string - Additional CSS classes for the preview (merged with variant)
 * - showControls: boolean - Whether to show edit/save/cancel buttons (default: false)
 * - showEditIcon: boolean - Whether to show only an edit icon trigger (no save/cancel) (default: false)
 * - label: string - Optional label text
 */
export default function EditableComponent(props) {
  const merged = mergeProps(
    {
      placeholder: 'Click to edit...',
      activationMode: 'dblclick',
      submitMode: 'both',
      selectOnFocus: true,
      autoResize: true,
      showControls: false,
      showEditIcon: false,
      variant: 'default',
    },
    props,
  );

  const value = () => merged.value;
  const defaultValue = () => merged.defaultValue;
  const placeholder = () => merged.placeholder;
  const disabled = () => merged.disabled;
  const readOnly = () => merged.readOnly;
  const autoResize = () => merged.autoResize;
  const activationMode = () => merged.activationMode;
  const submitMode = () => merged.submitMode;
  const selectOnFocus = () => merged.selectOnFocus;
  const maxLength = () => merged.maxLength;
  const showControls = () => merged.showControls;
  const showEditIcon = () => merged.showEditIcon;
  const variant = () => merged.variant;
  const variantStyles = () => variants[variant()] || variants.default;
  const classValue = () => merged.class;
  const areaClass = () => merged.areaClass;
  const inputClass = () => merged.inputClass;
  const previewClass = () => merged.previewClass;
  const label = () => merged.label;

  const handleValueChange = details => {
    if (merged.onChange) {
      merged.onChange(details.value);
    }
  };

  const handleValueCommit = details => {
    if (merged.onSubmit) {
      merged.onSubmit(details.value);
    }
  };

  const handleValueRevert = () => {
    if (merged.onCancel) {
      merged.onCancel();
    }
  };

  // Use value if provided, otherwise defaultValue, otherwise empty string
  const editableValue = () => value() ?? defaultValue() ?? '';

  return (
    <Editable.Root
      value={value() !== undefined ? value() : undefined}
      defaultValue={value() === undefined ? editableValue() : undefined}
      placeholder={placeholder()}
      disabled={disabled()}
      readOnly={readOnly()}
      autoResize={autoResize()}
      activationMode={activationMode()}
      submitMode={submitMode()}
      selectOnFocus={selectOnFocus()}
      maxLength={maxLength()}
      onValueChange={handleValueChange}
      onValueCommit={handleValueCommit}
      onValueRevert={handleValueRevert}
      class={cn('group inline-block', classValue())}
    >
      <Editable.Context>
        {api => (
          <>
            <Show when={label()}>
              <Editable.Label class='mb-1 block text-sm font-medium text-gray-700'>
                {label()}
              </Editable.Label>
            </Show>

            <div class='flex items-center gap-2'>
              <Editable.Area
                class={cn(
                  variantStyles().area,
                  disabled() && 'cursor-not-allowed opacity-50',
                  areaClass(),
                )}
              >
                <Editable.Input class={cn(variantStyles().input, inputClass())} />
                <Editable.Preview
                  class={cn(
                    variantStyles().preview,
                    !api().value && 'text-gray-400',
                    previewClass(),
                  )}
                >
                  {api().value || placeholder()}
                </Editable.Preview>
              </Editable.Area>

              {/* External controls for edit mode */}
              <Show when={showControls()}>
                <div class='flex items-center gap-1'>
                  <Show
                    when={api().editing}
                    fallback={
                      <Editable.EditTrigger class='rounded p-1 text-gray-400 opacity-0 transition-colors group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-600'>
                        <FiEdit2 class='h-4 w-4' />
                      </Editable.EditTrigger>
                    }
                  >
                    <Editable.SubmitTrigger class='rounded p-1 text-green-500 transition-colors hover:bg-green-50 hover:text-green-600'>
                      <FiCheck class='h-4 w-4' />
                    </Editable.SubmitTrigger>
                    <Editable.CancelTrigger class='rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600'>
                      <FiX class='h-4 w-4' />
                    </Editable.CancelTrigger>
                  </Show>
                </div>
              </Show>

              {/* Edit icon only (no save/cancel) */}
              <Show when={showEditIcon() && !showControls() && !api().editing}>
                <Editable.EditTrigger class='rounded p-1 text-gray-400 opacity-0 transition-colors group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-600'>
                  <FiEdit2 class='h-4 w-4' />
                </Editable.EditTrigger>
              </Show>
            </div>
          </>
        )}
      </Editable.Context>
    </Editable.Root>
  );
}

export { EditableComponent as Editable };
