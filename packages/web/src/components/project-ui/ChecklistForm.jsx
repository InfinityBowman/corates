/**
 * ChecklistForm component - Form to add a checklist to a study
 */

import { createSignal, For } from 'solid-js';
import { CHECKLIST_TYPES } from '../../AMSTAR2/checklist-map';

export default function ChecklistForm(props) {
  const [type, setType] = createSignal('AMSTAR2');
  const [assigneeId, setAssigneeId] = createSignal('');

  const handleSubmit = () => {
    props.onSubmit(type(), assigneeId() || undefined);
    setType('AMSTAR2');
    setAssigneeId('');
  };

  const members = () => props.members || [];

  return (
    <div class='bg-blue-50 border border-blue-200 rounded-lg p-4 m-4'>
      <h4 class='text-base font-semibold text-gray-900 mb-3'>Add Checklist</h4>
      <div class='space-y-3'>
        <div>
          <label class='block text-sm font-semibold text-gray-700 mb-1'>Checklist Type</label>
          <select
            value={type()}
            onChange={e => setType(e.target.value)}
            class='w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
          >
            <For each={Object.keys(CHECKLIST_TYPES)}>
              {checklistType => <option value={checklistType}>{checklistType}</option>}
            </For>
          </select>
        </div>
        <div>
          <label class='block text-sm font-semibold text-gray-700 mb-1'>Assignee (Optional)</label>
          <select
            value={assigneeId()}
            onChange={e => setAssigneeId(e.target.value)}
            class='w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
          >
            <option value=''>Unassigned</option>
            <For each={members()}>
              {member => (
                <option value={member.userId}>
                  {member.displayName || member.name || member.email || 'Unknown'}
                </option>
              )}
            </For>
          </select>
        </div>
      </div>
      <div class='flex gap-2 mt-4'>
        <button
          onClick={handleSubmit}
          disabled={props.loading}
          class='px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors'
        >
          {props.loading ? 'Adding...' : 'Add Checklist'}
        </button>
        <button
          onClick={() => props.onCancel()}
          class='px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:border-blue-300 hover:text-blue-600 transition-colors'
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
