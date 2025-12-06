import { For, Show } from 'solid-js';
import ChartSection from '../ChartSection.jsx';
import ReviewerAssignment from '../ReviewerAssignment.jsx';
import ProjectSettings from '../ProjectSettings.jsx';

export default function OverviewTab(props) {
  return (
    <>
      {/* Stats Summary */}
      <div class='grid grid-cols-2 gap-4 mb-6'>
        <div class='bg-gray-50 rounded-lg p-4 text-center'>
          <p class='text-2xl font-bold text-gray-900'>{props.studies().length}</p>
          <p class='text-sm text-gray-500'>Studies</p>
        </div>
        <div class='bg-gray-50 rounded-lg p-4 text-center'>
          <p class='text-2xl font-bold text-gray-900'>{props.members().length}</p>
          <p class='text-sm text-gray-500'>Members</p>
        </div>
      </div>

      {/* Project Settings */}
      <div class='mb-8'>
        <ProjectSettings
          meta={props.meta}
          studies={props.studies}
          onUpdateSettings={props.onUpdateSettings}
          onApplyNamingToAll={props.onApplyNamingToAll}
          isOwner={props.isOwner()}
        />
      </div>

      {/* Reviewer Assignment Section */}
      <Show when={props.isOwner() && props.studies().length > 0}>
        <div class='mb-8'>
          <ReviewerAssignment
            studies={props.studies}
            members={props.members}
            onAssignReviewers={props.onAssignReviewers}
          />
        </div>
      </Show>

      {/* Members Section */}
      <div class='mb-8'>
        <div class='flex items-center justify-between mb-4'>
          <h3 class='text-lg font-semibold text-gray-900'>Project Members</h3>
          <Show when={props.isOwner()}>
            <button
              onClick={() => props.onAddMember()}
              class='inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors gap-1.5'
            >
              <svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M12 4v16m8-8H4'
                />
              </svg>
              Add Member
            </button>
          </Show>
        </div>
        <Show when={props.members().length > 0}>
          <div class='bg-gray-50 rounded-lg divide-y divide-gray-200'>
            <For each={props.members()}>
              {member => {
                const isSelf = props.currentUserId === member.userId;
                const canRemove = props.isOwner() || isSelf;
                const isLastOwner =
                  member.role === 'owner' &&
                  props.members().filter(m => m.role === 'owner').length <= 1;

                return (
                  <div class='p-4 flex items-center justify-between'>
                    <div class='flex items-center gap-3'>
                      <Show
                        when={member.image}
                        fallback={
                          <div class='w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium'>
                            {(member.displayName || member.name || member.email || '?')
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                        }
                      >
                        <img
                          src={member.image}
                          alt={member.displayName || member.name || 'User'}
                          class='w-10 h-10 rounded-full object-cover'
                        />
                      </Show>
                      <div>
                        <p class='text-gray-900 font-medium'>
                          {member.displayName || member.name || 'Unknown'}
                          {isSelf && <span class='text-gray-400 ml-1'>(you)</span>}
                        </p>
                        <p class='text-gray-500 text-sm'>{member.email}</p>
                      </div>
                    </div>
                    <div class='flex items-center gap-2'>
                      <span class='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize'>
                        {member.role}
                      </span>
                      <Show when={canRemove && !isLastOwner}>
                        <button
                          onClick={() =>
                            props.onRemoveMember(
                              member.userId,
                              member.displayName || member.name || member.email,
                            )
                          }
                          class='p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors'
                          title={isSelf ? 'Leave project' : 'Remove member'}
                        >
                          <svg
                            class='w-4 h-4'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              stroke-linecap='round'
                              stroke-linejoin='round'
                              stroke-width='2'
                              d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                            />
                          </svg>
                        </button>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </div>

      {/* Charts Section */}
      <div>
        <h3 class='text-lg font-semibold text-gray-900 mb-4'>Quality Assessment Charts</h3>
        <ChartSection
          studies={props.studies}
          members={props.members}
          getChecklistData={props.getChecklistData}
        />
      </div>
    </>
  );
}
