/**
 * ChecklistForm component - Form to add a checklist to a study
 */

import { createSignal } from 'solid-js';
import { getChecklistTypeOptions, DEFAULT_CHECKLIST_TYPE } from '@/checklist-registry';
import { Select } from '@corates/ui';

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
          <Select
            label='Checklist Type'
            value={type()}
            onChange={value => setType(value)}
            items={typeOptions.map(option => ({
              label: `${option.label} - ${option.description}`,
              value: option.value,
            }))}
          />
        </div>
      </div>
      <div class='mt-4 flex gap-2'>
        <button
          onClick={handleSubmit}
          disabled={props.loading}
          class='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
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
