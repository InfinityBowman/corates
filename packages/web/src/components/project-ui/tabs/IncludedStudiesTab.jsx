import { For, Show } from 'solid-js';
import { AiOutlineBook } from 'solid-icons/ai';
import { BiRegularImport } from 'solid-icons/bi';
import StudyForm from '../StudyForm.jsx';

export default function IncludedStudiesTab(props) {
  return (
    <div class='space-y-4'>
      {/* Add Studies Section - Import button and StudyForm side by side */}
      <Show when={props.hasData()}>
        <div class='flex gap-4 items-start'>
          {/* Study Form / Drop Zone */}
          <div class='flex-1'>
            <StudyForm
              onSubmit={props.onCreateStudy}
              onCancel={() => props.onSetShowStudyForm(false)}
              onExpand={() => props.onSetShowStudyForm(true)}
              expanded={props.showStudyForm()}
              loading={props.creatingStudy()}
              hasExistingStudies={props.studies().length > 0}
            />
          </div>
          {/* Import from Reference Manager Button */}
          <button
            type='button'
            onClick={() => props.onOpenImportModal?.()}
            class='inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors shrink-0'
          >
            <BiRegularImport class='w-4 h-4' />
            Import References
          </button>
        </div>
      </Show>

      <Show when={!props.hasData()} fallback={null}>
        <div class='text-center py-12 bg-gray-50 rounded-lg'>
          <p class='text-gray-400'>Loading studies...</p>
        </div>
      </Show>

      {/* Study count */}
      <div class='flex items-center justify-between'>
        <p class='text-sm text-gray-500'>
          {props.studies().length} {props.studies().length === 1 ? 'study' : 'studies'} in this
          project
        </p>
      </div>

      <Show
        when={props.studies().length > 0}
        fallback={
          <Show when={props.hasData()}>
            <div class='text-center py-12 bg-gray-50 rounded-lg'>
              <AiOutlineBook class='w-12 h-12 text-gray-300 mx-auto mb-4' />
              <p class='text-gray-500'>No studies added yet. Add your first study above.</p>
            </div>
          </Show>
        }
      >
        <div class='bg-gray-50 rounded-lg divide-y divide-gray-200'>
          <For each={props.studies()}>
            {study => {
              // Get assigned reviewers from study-level assignments
              const assignedReviewers = () => {
                const reviewers = [];
                if (study.reviewer1) reviewers.push(props.getAssigneeName(study.reviewer1));
                if (study.reviewer2) reviewers.push(props.getAssigneeName(study.reviewer2));
                return reviewers;
              };
              const hasAssignedReviewers = () => study.reviewer1 || study.reviewer2;

              // Collect all unique assignees from checklists (for backward compatibility)
              const checklistAssignees = () => {
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
                    {/* Author/Year citation */}
                    <Show when={study.firstAuthor || study.publicationYear}>
                      <p class='text-xs text-gray-600'>
                        <span class='font-medium'>{study.firstAuthor || 'Unknown'}</span>
                        {study.publicationYear && ` (${study.publicationYear})`}
                        <Show when={study.journal}>
                          <span class='mx-1'>-</span>
                          <span class='italic'>{study.journal}</span>
                        </Show>
                      </p>
                    </Show>
                  </div>
                  <div class='flex items-center gap-2 ml-4'>
                    {/* Assigned reviewers from random assignment */}
                    <Show when={hasAssignedReviewers()}>
                      <div class='flex flex-wrap gap-1 justify-end'>
                        <For each={assignedReviewers()}>
                          {name => (
                            <span class='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                              {name}
                            </span>
                          )}
                        </For>
                      </div>
                    </Show>
                    {/* Fallback: show checklist assignees if no study-level reviewers */}
                    <Show when={!hasAssignedReviewers()}>
                      <Show
                        when={checklistAssignees().length > 0}
                        fallback={
                          <span class='text-sm text-gray-400 italic'>No reviewers assigned</span>
                        }
                      >
                        <div class='flex flex-wrap gap-1 justify-end'>
                          <For each={checklistAssignees()}>
                            {name => (
                              <span class='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                                {name}
                              </span>
                            )}
                          </For>
                        </div>
                      </Show>
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
