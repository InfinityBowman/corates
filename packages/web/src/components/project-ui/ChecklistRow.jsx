/**
 * ChecklistRow component - Displays a single checklist in a study
 */

import { createSignal, Show, For } from 'solid-js';
import { AiOutlineCheck } from 'solid-icons/ai';

export default function ChecklistRow(props) {
  const [editingAssignee, setEditingAssignee] = createSignal(false);

  // Get status badge styling
  const getStatusStyle = status => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAssigneeChange = e => {
    const newAssignee = e.target.value || null;
    props.onUpdate?.({ assignedTo: newAssignee });
    setEditingAssignee(false);
  };

  const members = () => props.members || [];

  // Handle row click - either toggle selection (reconcile mode) or do nothing
  const handleRowClick = e => {
    if (props.reconcileMode) {
      e.preventDefault();
      props.onToggleSelect?.();
    }
  };

  return (
    <div
      class={`p-4 transition-colors flex items-center justify-between group ${
        props.reconcileMode ?
          props.isSelected ?
            'bg-purple-50 border-l-4 border-purple-500 cursor-pointer'
          : 'hover:bg-purple-50/50 cursor-pointer'
        : 'hover:bg-gray-50'
      }`}
      onClick={handleRowClick}
    >
      {/* Selection checkbox in reconcile mode */}
      <Show when={props.reconcileMode}>
        <div class='mr-3'>
          <div
            class={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              props.isSelected ?
                'bg-purple-600 border-purple-600'
              : 'border-gray-300 hover:border-purple-400'
            }`}
          >
            <Show when={props.isSelected}>
              <AiOutlineCheck class='w-3 h-3 text-white' />
            </Show>
          </div>
        </div>
      </Show>

      <div class='flex-1'>
        <div class='flex items-center gap-3'>
          <h4 class='text-gray-900 font-medium'>{props.checklist.type || 'AMSTAR2'} Checklist</h4>
          <span
            class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(props.checklist.status)}`}
          >
            {props.checklist.status || 'pending'}
          </span>
        </div>
        <div class='text-gray-500 text-sm mt-1 flex items-center gap-1'>
          <span>Assigned to:</span>
          <Show
            when={!editingAssignee() && !props.reconcileMode}
            fallback={
              <Show when={!props.reconcileMode}>
                <select
                  value={props.checklist.assignedTo || ''}
                  onChange={handleAssigneeChange}
                  onBlur={() => setEditingAssignee(false)}
                  class='border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                  autofocus
                  onClick={e => e.stopPropagation()}
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
              </Show>
            }
          >
            <button
              onClick={e => {
                e.stopPropagation();
                setEditingAssignee(true);
              }}
              class='hover:text-blue-600 hover:underline cursor-pointer'
              title='Click to change assignee'
            >
              {props.getAssigneeName ?
                props.getAssigneeName(props.checklist.assignedTo)
              : 'Unassigned'}
            </button>
          </Show>
          <Show when={props.reconcileMode}>
            <span class='text-gray-600'>
              {props.getAssigneeName ?
                props.getAssigneeName(props.checklist.assignedTo)
              : 'Unassigned'}
            </span>
          </Show>
        </div>
      </div>

      {/* Actions - hide in reconcile mode */}
      <Show when={!props.reconcileMode}>
        <div class='flex items-center gap-2'>
          <button
            onClick={e => {
              e.stopPropagation();
              props.onOpen();
            }}
            class='px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors'
          >
            Open
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              props.onDelete?.();
            }}
            class='p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100'
            title='Delete Checklist'
          >
            <svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                stroke-linecap='round'
                stroke-linejoin='round'
                stroke-width='2'
                d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
              />
            </svg>
          </button>
        </div>
      </Show>
    </div>
  );
}
