/**
 * Editable - An inline editable single-line text component using Ark UI
 */

import { Editable } from '@ark-ui/solid/editable';
import { Component, Show, mergeProps } from 'solid-js';
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
} as const;

export interface EditableProps {
  /** The controlled value */
  value?: string;
  /** The initial value (uncontrolled) */
  defaultValue?: string;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Called when value changes (on each keystroke) */
  onChange?: (_value: string) => void;
  /** Called when value is committed (Enter/blur/submit button) */
  onSubmit?: (_value: string) => void;
  /** Called when editing is cancelled */
  onCancel?: () => void;
  /** Whether the editable is disabled */
  disabled?: boolean;
  /** Whether the editable is read-only (can view but not edit) */
  readOnly?: boolean;
  /** Whether to auto-resize to fit content */
  autoResize?: boolean;
  /** How to enter edit mode (default: 'dblclick') */
  activationMode?: 'focus' | 'dblclick' | 'click' | 'none';
  /** What triggers submit (default: 'both') */
  submitMode?: 'enter' | 'blur' | 'none' | 'both';
  /** Whether to select text when focused */
  selectOnFocus?: boolean;
  /** Maximum characters allowed */
  maxLength?: number;
  /** Style preset (default: 'default') */
  variant?: 'default' | 'inline' | 'heading' | 'field';
  /** Additional CSS classes for the root */
  class?: string;
  /** Additional CSS classes for the area (input/preview container) */
  areaClass?: string;
  /** Additional CSS classes for the input (merged with variant) */
  inputClass?: string;
  /** Additional CSS classes for the preview (merged with variant) */
  previewClass?: string;
  /** Whether to show edit/save/cancel buttons (default: false) */
  showControls?: boolean;
  /** Whether to show only an edit icon trigger (no save/cancel) (default: false) */
  showEditIcon?: boolean;
  /** Optional label text */
  label?: string;
}

/**
 * Editable - An inline editable single-line text component using Ark UI
 *
 * Best for: titles, names, labels - single line text that can be edited inline.
 * For multi-line text (descriptions, notes), use a manual textarea approach instead.
 */
const EditableComponent: Component<EditableProps> = props => {
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
  const activationMode = () =>
    merged.activationMode as 'focus' | 'dblclick' | 'click' | 'none' | undefined;
  const submitMode = () => merged.submitMode as 'enter' | 'blur' | 'none' | 'both' | undefined;
  const selectOnFocus = () => merged.selectOnFocus;
  const maxLength = () => merged.maxLength;
  const showControls = () => merged.showControls;
  const showEditIcon = () => merged.showEditIcon;
  const variant = () => merged.variant;
  const variantStyles = () => {
    const v = variant() || 'default';
    return variants[v as keyof typeof variants] || variants.default;
  };
  const classValue = () => merged.class;
  const areaClass = () => merged.areaClass;
  const inputClass = () => merged.inputClass;
  const previewClass = () => merged.previewClass;
  const label = () => merged.label;

  const handleValueChange = (details: { value: string }) => {
    if (merged.onChange) {
      merged.onChange(details.value);
    }
  };

  const handleValueCommit = (details: { value: string }) => {
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
};

export { EditableComponent as Editable };
export default EditableComponent;

// Export raw Ark UI primitive for custom layouts
export { Editable as EditablePrimitive };
