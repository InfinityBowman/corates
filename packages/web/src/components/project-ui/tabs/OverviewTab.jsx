import { For, Show } from 'solid-js';
import { FiPlus, FiTrash2 } from 'solid-icons/fi';
import ChartSection from '../ChartSection.jsx';
import ReviewerAssignment from '../ReviewerAssignment.jsx';
import ProjectSettings from '../ProjectSettings.jsx';
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
  const { projectId, handlers, projectActions, isOwner } = useProjectContext();

  // Read from store directly
  const studies = () => projectStore.getStudies(projectId);
  const members = () => projectStore.getMembers(projectId);
  const meta = () => projectStore.getMeta(projectId);
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
      <div class='grid grid-cols-2 md:grid-cols-4 gap-4 mb-6'>
        <div class='bg-gray-50 rounded-lg p-4 text-center'>
          <p class='text-2xl font-bold text-gray-900'>{studies().length}</p>
          <p class='text-sm text-gray-500'>Total Studies</p>
        </div>
        <div class='bg-blue-50 rounded-lg p-4 text-center'>
          <p class='text-2xl font-bold text-blue-900'>{inProgressStudies()}</p>
          <p class='text-sm text-blue-600'>In Progress</p>
        </div>
        <div class='bg-green-50 rounded-lg p-4 text-center'>
          <p class='text-2xl font-bold text-green-900'>{readyToReconcile()}</p>
          <p class='text-sm text-green-600'>Ready to Reconcile</p>
        </div>
      </div>

      {/* Two-column layout for better space utilization */}
      <div class='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8'>
        {/* Left Column */}
        <div class='space-y-6'>
          {/* Project Settings */}
          <ProjectSettings
            meta={meta}
            studies={studies}
            onUpdateSettings={projectActions.updateProjectSettings}
            onApplyNamingToAll={handlers.studyHandlers.handleApplyNamingToAll}
            isOwner={isOwner()}
          />

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
            <div class='flex items-center justify-between mb-4'>
              <h3 class='text-lg font-semibold text-gray-900'>Project Members</h3>
              <Show when={isOwner()}>
                <button
                  onClick={() => props.onAddMember()}
                  class='inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors gap-1.5'
                >
                  <FiPlus class='w-4 h-4' />
                  Add Member
                </button>
              </Show>
            </div>
            <Show when={members().length > 0}>
              <div class='bg-gray-50 rounded-lg divide-y divide-gray-200'>
                <For each={members()}>
                  {member => {
                    const isSelf = currentUserId() === member.userId;
                    const canRemove = isOwner() || isSelf;
                    const isLastOwner =
                      member.role === 'owner' &&
                      members().filter(m => m.role === 'owner').length <= 1;

                    return (
                      <div class='p-4 flex items-center justify-between'>
                        <div class='flex items-center gap-3'>
                          <Avatar
                            src={member.image}
                            name={member.displayName || member.name || member.email}
                            class='w-10 h-10 rounded-full overflow-hidden'
                            fallbackClass='flex items-center justify-center w-full h-full bg-blue-600 text-white font-medium'
                          />
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
                                handlers.memberHandlers.handleRemoveMember(
                                  member.userId,
                                  member.displayName || member.name || member.email,
                                )
                              }
                              class='p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors'
                              title={isSelf ? 'Leave project' : 'Remove member'}
                            >
                              <FiTrash2 class='w-4 h-4' />
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
        <h3 class='text-lg font-semibold text-gray-900 mb-4'>Quality Assessment Charts</h3>
        <ChartSection
          studies={studies}
          members={members}
          getChecklistData={projectActions.getChecklistData}
        />
      </div>
    </>
  );
}
