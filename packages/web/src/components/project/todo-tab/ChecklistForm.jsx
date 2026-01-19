/**
 * ChecklistForm component - Form to add a checklist to a study
 */

import { createSignal } from 'solid-js';
import { getChecklistTypeOptions, DEFAULT_CHECKLIST_TYPE } from '@/checklist-registry';
import { SimpleSelect } from '@/components/ui/select';

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
          <SimpleSelect
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
          class='bg-primary hover:bg-primary/90 focus:ring-primary rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
        >
          {props.loading ? 'Adding...' : 'Add Checklist'}
        </button>
        <button
          onClick={() => props.onCancel()}
          class='border-border bg-card text-secondary-foreground hover:border-primary/50 hover:text-primary rounded-lg border px-4 py-2 text-sm font-medium transition-colors'
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
