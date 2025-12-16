import * as editable from '@zag-js/editable';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId, Show, mergeProps } from 'solid-js';
import { FiCheck, FiX, FiEdit2 } from 'solid-icons/fi';

/**
 * Editable - An inline editable single-line text component using Zag.js
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
 * - class: string - Additional CSS classes for the root
 * - inputClass: string - Additional CSS classes for the input
 * - previewClass: string - Additional CSS classes for the preview
 * - showControls: boolean - Whether to show edit/save/cancel buttons (default: false)
 * - label: string - Optional label text
 */
export default function Editable(props) {
  const merged = mergeProps(
    {
      placeholder: 'Click to edit...',
      activationMode: 'dblclick',
      submitMode: 'both',
      selectOnFocus: true,
      autoResize: true,
      showControls: false,
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
  const classValue = () => merged.class;
  const inputClass = () => merged.inputClass;
  const previewClass = () => merged.previewClass;
  const label = () => merged.label;

  const service = useMachine(editable.machine, () => ({
    id: createUniqueId(),
    value: value(),
    defaultValue: defaultValue(),
    placeholder: placeholder(),
    disabled: disabled(),
    readOnly: readOnly(),
    autoResize: autoResize(),
    activationMode: activationMode(),
    submitMode: submitMode(),
    selectOnFocus: selectOnFocus(),
    maxLength: maxLength(),
    onValueChange(details) {
      merged.onChange?.(details.value);
    },
    onValueCommit(details) {
      merged.onSubmit?.(details.value);
    },
    onValueRevert() {
      merged.onCancel?.();
    },
  }));

  const api = createMemo(() => editable.connect(service, normalizeProps));

  return (
    <div {...api().getRootProps()} class={`group inline-block ${classValue() || ''}`}>
      <Show when={label()}>
        <label {...api().getLabelProps()} class='block text-sm font-medium text-gray-700 mb-1'>
          {label()}
        </label>
      </Show>

      <div class='flex items-center gap-2'>
        <div
          {...api().getAreaProps()}
          class={`
            rounded transition-colors
            ${disabled() ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            {...api().getInputProps()}
            class={`
              px-2 py-1 border border-transparent rounded
              focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
              ${inputClass() || ''}
            `}
          />
          <span
            {...api().getPreviewProps()}
            class={`
              px-2 py-1 rounded cursor-pointer
              hover:bg-gray-100 transition-colors
              ${!api().value ? 'text-gray-400' : ''}
              ${previewClass() || ''}
            `}
          >
            {api().value || placeholder()}
          </span>
        </div>

        {/* External controls for edit mode */}
        <Show when={showControls()}>
          <div class='flex items-center gap-1'>
            <Show
              when={api().editing}
              fallback={
                <button
                  {...api().getEditTriggerProps()}
                  class='p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100'
                >
                  <FiEdit2 class='w-4 h-4' />
                </button>
              }
            >
              <button
                {...api().getSubmitTriggerProps()}
                class='p-1 text-green-500 hover:text-green-600 rounded hover:bg-green-50 transition-colors'
              >
                <FiCheck class='w-4 h-4' />
              </button>
              <button
                {...api().getCancelTriggerProps()}
                class='p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors'
              >
                <FiX class='w-4 h-4' />
              </button>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}
