/**
 * SettingField - Reusable inline edit field wrapper for settings pages
 * Handles label, value display, edit button layout, and edit/cancel/save flow
 */

import { Show } from 'solid-js';

/**
 * @param {Object} props
 * @param {string} props.label - Field label (displayed uppercase)
 * @param {JSX.Element | string} props.value - Display value when not editing
 * @param {boolean} props.editing - Whether field is in edit mode
 * @param {() => void} props.onEdit - Called when Edit button clicked
 * @param {() => void} props.onCancel - Called when Cancel button clicked
 * @param {() => void} props.onSave - Called when Save button clicked
 * @param {boolean} [props.saving] - Whether save is in progress
 * @param {JSX.Element} [props.editContent] - Content to show when editing
 * @param {boolean} [props.showDivider] - Whether to show top border divider
 */
export default function SettingField(props) {
  return (
    <div
      class={`flex items-start justify-between ${props.showDivider ? 'border-t border-gray-100 pt-4' : ''}`}
    >
      <div class='flex-1'>
        <label class='block text-xs font-medium tracking-wide text-gray-500 uppercase'>
          {props.label}
        </label>
        <Show
          when={props.editing}
          fallback={<div class='mt-1 text-gray-900'>{props.value || 'Not set'}</div>}
        >
          <div class='mt-2'>{props.editContent}</div>
        </Show>
      </div>
      <Show
        when={props.editing}
        fallback={
          <button
            onClick={props.onEdit}
            class='ml-4 text-sm font-medium text-blue-600 hover:text-blue-700'
          >
            Edit
          </button>
        }
      >
        <div class='ml-4 flex space-x-2'>
          <button
            onClick={() => props.onSave?.()}
            disabled={props.saving}
            class='rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50'
          >
            Save
          </button>
          <button
            onClick={() => props.onCancel?.()}
            disabled={props.saving}
            class='px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50'
          >
            Cancel
          </button>
        </div>
      </Show>
    </div>
  );
}
