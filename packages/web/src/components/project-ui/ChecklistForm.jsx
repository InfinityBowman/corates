/**
 * ChecklistForm component - Form to add a checklist to a study
 */

import { createSignal, For } from 'solid-js';
import { getChecklistTypeOptions, DEFAULT_CHECKLIST_TYPE } from '@/checklist-registry';

export default function ChecklistForm(props) {
  const [type, setType] = createSignal(DEFAULT_CHECKLIST_TYPE);
  const typeOptions = getChecklistTypeOptions();

  const handleSubmit = () => {
    // Always assign to the current user
    props.onSubmit(type(), props.currentUserId);
    setType(DEFAULT_CHECKLIST_TYPE);
  };

  return (
    <div class='m-4 rounded-lg border border-blue-200 bg-blue-50 p-4'>
      <div class='space-y-3'>
        <div>
          <label class='mb-1 block text-sm font-semibold text-gray-700'>Checklist Type</label>
          <select
            value={type()}
            onChange={e => setType(e.target.value)}
            class='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 transition focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none'
          >
            <For each={typeOptions}>
              {option => (
                <option value={option.value}>
                  {option.label} - {option.description}
                </option>
              )}
            </For>
          </select>
        </div>
      </div>
      <div class='mt-4 flex gap-2'>
        <button
          onClick={handleSubmit}
          disabled={props.loading}
          class='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400'
        >
          {props.loading ? 'Adding...' : 'Add Checklist'}
        </button>
        <button
          onClick={() => props.onCancel()}
          class='rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-blue-300 hover:text-blue-600'
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
