/**
 * ChecklistForm component - Form to add a checklist to a review
 */

import { createSignal, For } from 'solid-js';
import { CHECKLIST_TYPES } from '../../checklist/checklistMap';

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
    <div class='bg-gray-900 border border-gray-700 rounded-lg p-4 mt-4'>
      <h4 class='text-md font-semibold text-white mb-3'>Add Checklist</h4>
      <div class='space-y-3'>
        <div>
          <label class='block text-sm font-medium text-gray-300 mb-1'>Checklist Type</label>
          <select
            value={type()}
            onChange={e => setType(e.target.value)}
            class='w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500'
          >
            <For each={Object.keys(CHECKLIST_TYPES)}>
              {checklistType => <option value={checklistType}>{checklistType}</option>}
            </For>
          </select>
        </div>
        <div>
          <label class='block text-sm font-medium text-gray-300 mb-1'>Assignee (Optional)</label>
          <select
            value={assigneeId()}
            onChange={e => setAssigneeId(e.target.value)}
            class='w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500'
          >
            <option value=''>Unassigned</option>
            <For each={members()}>
              {member => (
                <option value={member.userId}>{member.userName || member.userEmail}</option>
              )}
            </For>
          </select>
        </div>
      </div>
      <div class='flex gap-2 mt-4'>
        <button
          onClick={handleSubmit}
          disabled={props.loading}
          class='bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-sm transition-colors'
        >
          {props.loading ? 'Adding...' : 'Add Checklist'}
        </button>
        <button
          onClick={() => props.onCancel()}
          class='bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors'
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
