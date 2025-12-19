import { For, Show } from 'solid-js';
import { FiPlus, FiTrash2 } from 'solid-icons/fi';
import ChartSection from '../ChartSection.jsx';
import ReviewerAssignment from '../ReviewerAssignment.jsx';
import projectStore from '@/stores/projectStore.js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useProjectContext } from '../ProjectContext.jsx';
import { Avatar } from '@corates/ui';

/**
 * OverviewTab - Project overview with stats, settings, and members
 *
 * Props:
 * - onAddMember: () => void
 */
export default function OverviewTab(props) {
  const { user } = useBetterAuth();
  const { projectId, handlers, isOwner, projectActions } = useProjectContext();

  // Read from store directly
  const studies = () => projectStore.getStudies(projectId);
  const members = () => projectStore.getMembers(projectId);
  const currentUserId = () => user()?.id;

  // Calculate additional stats

  const inProgressStudies = () =>
    studies().filter(s => {
      const checklists = s.checklists || [];
      return checklists.some(c => c.status === 'in_progress');
    }).length;

  const readyToReconcile = () =>
    studies().filter(s => {
      const checklists = s.checklists || [];
      const completedChecklists = checklists.filter(c => c.status === 'completed');
      return completedChecklists.length === 2;
    }).length;

  return (
    <>
      {/* Stats Summary */}
      <div class='mb-6 grid grid-cols-2 gap-4 md:grid-cols-4'>
        <div class='rounded-lg bg-gray-50 p-4 text-center'>
          <p class='text-2xl font-bold text-gray-900'>{studies().length}</p>
          <p class='text-sm text-gray-500'>Total Studies</p>
        </div>
        <div class='rounded-lg bg-blue-50 p-4 text-center'>
          <p class='text-2xl font-bold text-blue-900'>{inProgressStudies()}</p>
          <p class='text-sm text-blue-600'>In Progress</p>
        </div>
        <div class='rounded-lg bg-green-50 p-4 text-center'>
          <p class='text-2xl font-bold text-green-900'>{readyToReconcile()}</p>
          <p class='text-sm text-green-600'>Ready to Reconcile</p>
        </div>
      </div>

      {/* Two-column layout for better space utilization */}
      <div class='mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Left Column */}
        <div class='space-y-6'>
          {/* Reviewer Assignment Section */}
          <Show when={isOwner() && studies().length > 0}>
            <ReviewerAssignment
              studies={studies}
              members={members}
              onAssignReviewers={handlers.studyHandlers.handleUpdateStudy}
            />
          </Show>
        </div>

        {/* Right Column */}
        <div class='space-y-6'>
          {/* Members Section */}
          <div>
            <div class='mb-4 flex items-center justify-between'>
              <h3 class='text-lg font-semibold text-gray-900'>Project Members</h3>
              <Show when={isOwner()}>
                <button
                  onClick={() => props.onAddMember()}
                  class='inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700'
                >
                  <FiPlus class='h-4 w-4' />
                  Add Member
                </button>
              </Show>
            </div>
            <Show when={members().length > 0}>
              <div class='divide-y divide-gray-200 rounded-lg bg-gray-50'>
                <For each={members()}>
                  {member => {
                    const isSelf = currentUserId() === member.userId;
                    const canRemove = isOwner() || isSelf;
                    const isLastOwner =
                      member.role === 'owner' &&
                      members().filter(m => m.role === 'owner').length <= 1;

                    return (
                      <div class='flex items-center justify-between p-4'>
                        <div class='flex items-center gap-3'>
                          <Avatar
                            src={member.image}
                            name={member.displayName || member.name || member.email}
                            class='h-10 w-10 overflow-hidden rounded-full'
                            fallbackClass='flex items-center justify-center w-full h-full bg-blue-600 text-white font-medium'
                          />
                          <div>
                            <p class='font-medium text-gray-900'>
                              {member.displayName || member.name || 'Unknown'}
                              {isSelf && <span class='ml-1 text-gray-400'>(you)</span>}
                            </p>
                            <p class='text-sm text-gray-500'>{member.email}</p>
                          </div>
                        </div>
                        <div class='flex items-center gap-2'>
                          <span class='inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 capitalize'>
                            {member.role}
                          </span>
                          <Show when={canRemove && !isLastOwner}>
                            <button
                              onClick={() =>
                                handlers.memberHandlers.handleRemoveMember(
                                  member.userId,
                                  member.displayName || member.name || member.email,
                                )
                              }
                              class='rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600'
                              title={isSelf ? 'Leave project' : 'Remove member'}
                            >
                              <FiTrash2 class='h-4 w-4' />
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
        </div>
      </div>

      {/* Charts Section - Full width */}
      <div>
        <h3 class='mb-4 text-lg font-semibold text-gray-900'>Quality Assessment Charts</h3>
        <ChartSection
          studies={studies}
          members={members}
          getChecklistData={projectActions.getChecklistData}
        />
      </div>
    </>
  );
}
