import { For, Show } from 'solid-js';
import { AiOutlineBook } from 'solid-icons/ai';

export default function IncludedStudiesTab(props) {
  return (
    <div class='space-y-4'>
      <div class='flex items-center justify-between'>
        <p class='text-sm text-gray-500'>
          {props.studies().length} {props.studies().length === 1 ? 'study' : 'studies'} in this
          project
        </p>
      </div>

      <Show
        when={props.studies().length > 0}
        fallback={
          <div class='text-center py-12 bg-gray-50 rounded-lg'>
            <AiOutlineBook class='w-12 h-12 text-gray-300 mx-auto mb-4' />
            <p class='text-gray-500'>No studies added yet.</p>
            <p class='text-sm text-gray-400 mt-1'>Go to the "In Progress" tab to add studies.</p>
          </div>
        }
      >
        <div class='bg-gray-50 rounded-lg divide-y divide-gray-200'>
          <For each={props.studies()}>
            {study => {
              // Collect all unique assignees from checklists
              const assignees = () => {
                const uniqueAssignees = new Map();
                for (const checklist of study.checklists || []) {
                  if (checklist.assigneeId) {
                    uniqueAssignees.set(
                      checklist.assigneeId,
                      props.getAssigneeName(checklist.assigneeId),
                    );
                  }
                }
                return Array.from(uniqueAssignees.values());
              };

              return (
                <div class='p-4 flex items-center justify-between'>
                  <div class='flex-1 min-w-0'>
                    <p class='text-gray-900 font-medium truncate'>
                      {study.name || 'Untitled Study'}
                    </p>
                    <p class='text-sm text-gray-500'>
                      {study.checklists?.length || 0}{' '}
                      {(study.checklists?.length || 0) === 1 ? 'checklist' : 'checklists'}
                    </p>
                  </div>
                  <div class='flex items-center gap-2 ml-4'>
                    <Show
                      when={assignees().length > 0}
                      fallback={
                        <span class='text-sm text-gray-400 italic'>No reviewers assigned</span>
                      }
                    >
                      <div class='flex flex-wrap gap-1 justify-end'>
                        <For each={assignees()}>
                          {name => (
                            <span class='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                              {name}
                            </span>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}
