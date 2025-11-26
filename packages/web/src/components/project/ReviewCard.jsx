/**
 * ReviewCard component - Displays a single review with its checklists
 */

import { For, Show } from 'solid-js';
import ChecklistForm from './ChecklistForm.jsx';
import ChecklistRow from './ChecklistRow.jsx';

export default function ReviewCard(props) {
  const handleCreateChecklist = (type, assigneeId) => {
    props.onAddChecklist(type, assigneeId);
  };

  return (
    <div class='bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden'>
      {/* Review Header */}
      <div class='p-4 border-b border-gray-200 bg-gray-50'>
        <div class='flex items-center justify-between'>
          <div class='flex-1'>
            <h3 class='text-lg font-semibold text-gray-900'>{props.review.name}</h3>
            <Show when={props.review.description}>
              <p class='text-gray-500 text-sm mt-1'>{props.review.description}</p>
            </Show>
          </div>
          <div class='flex items-center gap-2'>
            <button
              onClick={() => props.onToggleChecklistForm()}
              class='inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors gap-1'
            >
              <svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M12 4v16m8-8H4'
                />
              </svg>
              Add Checklist
            </button>
          </div>
        </div>
      </div>

      {/* Add Checklist Form */}
      <Show when={props.showChecklistForm}>
        <ChecklistForm
          members={props.members}
          onSubmit={handleCreateChecklist}
          onCancel={() => props.onToggleChecklistForm()}
          loading={props.creatingChecklist}
        />
      </Show>

      {/* Checklists List */}
      <Show
        when={props.review.checklists?.length > 0}
        fallback={
          <div class='p-4 text-center text-gray-400 text-sm'>No checklists in this review yet</div>
        }
      >
        <div class='divide-y divide-gray-200'>
          <For each={props.review.checklists}>
            {checklist => (
              <ChecklistRow
                checklist={checklist}
                onOpen={() => props.onOpenChecklist(checklist.id)}
                getAssigneeName={props.getAssigneeName}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
