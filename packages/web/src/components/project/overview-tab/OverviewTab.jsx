import { For, Show, createSignal, createMemo } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { FiPlus, FiTrash2 } from 'solid-icons/fi';
import { AiOutlineBook } from 'solid-icons/ai';
import { BiRegularCheckCircle } from 'solid-icons/bi';
import { CgArrowsExchange } from 'solid-icons/cg';
import ChartSection from './ChartSection.jsx';
import AddMemberModal from './AddMemberModal.jsx';
import ReviewerAssignment from './ReviewerAssignment.jsx';
import AMSTAR2ResultsTable from './AMSTAR2ResultsTable.jsx';
import projectStore from '@/stores/projectStore.js';
import projectActionsStore from '@/stores/projectActionsStore';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useProjectContext } from '../ProjectContext.jsx';
import { Avatar, showToast, Progress, Collapsible } from '@corates/ui';
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogPositioner,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { API_BASE } from '@config/api.js';
import { CHECKLIST_STATUS } from '@/constants/checklist-status.js';
import { shouldShowInTab, isReconciledChecklist } from '@/lib/checklist-domain.js';
import {
  calculateInterRaterReliability,
  getKappaInterpretation,
} from '@/lib/inter-rater-reliability.js';
import CircularProgress from './CircularProgress.jsx';
import { useSubscription } from '@primitives/useSubscription.js';
import { useMembers } from '@/primitives/useMembers.js';

/**
 * OverviewTab - Project overview with stats, settings, and members
 * Uses projectActionsStore directly for mutations.
 */
export default function OverviewTab() {
  const [showAddMemberModal, setShowAddMemberModal] = createSignal(false);
  const [chartsExpanded, setChartsExpanded] = createSignal(false);
  const [tablesExpanded, setTablesExpanded] = createSignal(false);

  const { user } = useBetterAuth();
  const { projectId, orgId, isOwner } = useProjectContext();
  const navigate = useNavigate();

  // Remove member confirmation dialog state
  const [removeDialogOpen, setRemoveDialogOpen] = createSignal(false);
  const [pendingRemoveMember, setPendingRemoveMember] = createSignal(null);

  // Subscription/quota checks for member addition
  const { hasQuota, quotas } = useSubscription();
  const { memberCount: orgMemberCount } = useMembers();

  // Read from store directly
  const studies = () => projectStore.getStudies(projectId);
  const members = () => projectStore.getMembers(projectId);
  const currentUserId = () => user()?.id;

  // Check if can add more collaborators (quota check)
  const collaboratorQuotaInfo = createMemo(() => {
    const max = quotas()?.['collaborators.org.max'] ?? 0;
    const used = orgMemberCount();
    return { used, max };
  });

  const canAddMember = createMemo(() => {
    if (!isOwner()) return false;
    return hasQuota('collaborators.org.max', { used: orgMemberCount(), requested: 1 });
  });

  // Calculate additional stats

  const readyToReconcile = () =>
    studies().filter(s => {
      const checklists = s.checklists || [];
      // Count non-reconciled checklists with REVIEWER_COMPLETED status
      const awaitingReconcile = checklists.filter(
        c => !isReconciledChecklist(c) && c.status === CHECKLIST_STATUS.REVIEWER_COMPLETED,
      );
      return awaitingReconcile.length === 2;
    }).length;

  const completedStudies = () =>
    studies().filter(s => shouldShowInTab(s, 'completed', null)).length;

  // Calculate overall progress (completed studies / total studies)
  const overallProgress = createMemo(() => {
    const total = studies().length;
    if (total === 0) return 0;
    const completed = completedStudies();
    return Math.round((completed / total) * 100);
  });

  // Calculate user progress for all users (memoized for performance)
  const userProgressMap = createMemo(() => {
    const progressMap = new Map();

    studies().forEach(study => {
      // Get all user IDs assigned to this study
      const assignedUserIds = [];
      if (study.reviewer1) assignedUserIds.push(study.reviewer1);
      if (study.reviewer2) assignedUserIds.push(study.reviewer2);

      assignedUserIds.forEach(userId => {
        if (!progressMap.has(userId)) {
          progressMap.set(userId, { completed: 0, total: 0 });
        }

        const progress = progressMap.get(userId);
        progress.total++; // Count this study as assigned

        // Check if user has a completed checklist in this study
        const checklists = study.checklists || [];
        const userChecklists = checklists.filter(c => c.assignedTo === userId);
        const hasCompleted = userChecklists.some(
          c =>
            c.status === CHECKLIST_STATUS.FINALIZED ||
            c.status === CHECKLIST_STATUS.REVIEWER_COMPLETED,
        );

        if (hasCompleted) {
          progress.completed++;
        }
      });
    });

    // Convert to percentage
    const result = new Map();
    progressMap.forEach((progress, userId) => {
      result.set(userId, {
        percentage:
          progress.total === 0 ? 0 : Math.round((progress.completed / progress.total) * 100),
        completed: progress.completed,
        total: progress.total,
      });
    });

    return result;
  });

  // Helper to get user progress
  const getUserProgress = userId => {
    if (!userId) return { percentage: 0, completed: 0, total: 0 };
    return userProgressMap().get(userId) || { percentage: 0, completed: 0, total: 0 };
  };

  // Handlers (use active project - no projectId needed)
  const handleUpdateStudy = (studyId, updates) => {
    projectActionsStore.study.update(studyId, updates);
  };

  // Opens remove member confirmation dialog
  const handleRemoveMember = (memberId, memberName) => {
    const currentUser = user();
    const isSelf = currentUser?.id === memberId;
    setPendingRemoveMember({ memberId, memberName, isSelf });
    setRemoveDialogOpen(true);
  };

  // Executes remove after confirmation
  const confirmRemoveMember = async () => {
    const pending = pendingRemoveMember();
    if (!pending) return;

    try {
      const result = await projectActionsStore.member.remove(pending.memberId);
      if (result.isSelf) {
        navigate('/dashboard', { replace: true });
        showToast.success('Left Project', 'You have left the project');
      } else {
        showToast.success(
          'Member Removed',
          `${pending.memberName} has been removed from the project`,
        );
      }
      setRemoveDialogOpen(false);
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, {
        toastTitle: 'Remove Failed',
      });
    }
  };

  const getChecklistData = (studyId, checklistId) => {
    return projectActionsStore.checklist.getData(studyId, checklistId);
  };

  // Calculate inter-rater reliability metrics
  const interRaterMetrics = createMemo(() => {
    return calculateInterRaterReliability(studies(), getChecklistData);
  });

  // Calculate unassigned studies for Reviewer Assignment visibility
  const unassignedStudies = createMemo(() => studies().filter(s => !s.reviewer1 && !s.reviewer2));

  // Determine if Reviewer Assignment should be shown
  const shouldShowReviewerAssignment = () =>
    isOwner() && studies().length > 0 && unassignedStudies().length > 0;

  return (
    <>
      {/* Section 1: Project Progress - Hero Section */}
      <div class='mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
        <h2 class='mb-6 text-lg font-semibold text-gray-900'>Team Progress</h2>

        <div class='mb-6 flex flex-col items-center md:flex-row md:items-start md:gap-8'>
          {/* Overall Progress - Circular */}
          <div class='mb-6 md:mb-0'>
            <CircularProgress
              value={overallProgress()}
              showValue={true}
              variant={
                overallProgress() === 100 ? 'success'
                : overallProgress() >= 50 ?
                  'default'
                : 'warning'
              }
              size={160}
            />
            <p class='mt-3 text-center text-sm text-gray-600'>
              {completedStudies()} of {studies().length} studies completed
            </p>
          </div>

          {/* Enhanced Stats Grid */}
          <div class='grid flex-1 grid-cols-2 gap-4 md:grid-cols-3'>
            <div class='rounded-lg border border-gray-200 bg-gray-50 p-5 text-center'>
              <div class='mb-2 flex justify-center'>
                <AiOutlineBook class='h-6 w-6 text-gray-600' />
              </div>
              <p class='text-3xl font-bold text-gray-900'>{studies().length}</p>
              <p class='mt-1 text-sm font-medium text-gray-600'>Total Studies</p>
            </div>
            <div class='rounded-lg border border-green-200 bg-green-50 p-5 text-center'>
              <div class='mb-2 flex justify-center'>
                <CgArrowsExchange class='h-6 w-6 text-green-700' />
              </div>
              <p class='text-3xl font-bold text-green-900'>{readyToReconcile()}</p>
              <p class='mt-1 text-sm font-medium text-green-700'>Ready to Reconcile</p>
            </div>
            <div class='rounded-lg border border-blue-200 bg-blue-50 p-5 text-center'>
              <div class='mb-2 flex justify-center'>
                <BiRegularCheckCircle class='h-6 w-6 text-blue-700' />
              </div>
              <p class='text-3xl font-bold text-blue-900'>{completedStudies()}</p>
              <p class='mt-1 text-sm font-medium text-blue-700'>Completed</p>
            </div>
          </div>
        </div>

        {/* Inter-rater Reliability Section */}
        <Show when={interRaterMetrics().studyCount > 0}>
          <div class='mt-6 rounded-lg border border-purple-200 bg-purple-50 p-5'>
            <h3 class='mb-4 text-base font-semibold text-gray-900'>Inter-rater Reliability</h3>
            <div class='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <div class='text-center'>
                <p class='text-2xl font-bold text-gray-900'>{interRaterMetrics().studyCount}</p>
                <p class='mt-1 text-sm text-gray-600'>Studies Included</p>
              </div>
              <div class='text-center'>
                <p class='text-2xl font-bold text-gray-900'>
                  {interRaterMetrics().percentAgreement != null ?
                    `${interRaterMetrics().percentAgreement.toFixed(1)}%`
                  : 'N/A'}
                </p>
                <p class='mt-1 text-sm text-gray-600'>Percent Agreement</p>
              </div>
              <div class='text-center'>
                <p class='text-2xl font-bold text-gray-900'>
                  {interRaterMetrics().cohensKappa != null ?
                    interRaterMetrics().cohensKappa.toFixed(3)
                  : 'N/A'}
                </p>
                <p class='mt-1 text-xs text-gray-600'>
                  Cohen's Kappa ({getKappaInterpretation(interRaterMetrics().cohensKappa)})
                </p>
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Section 2: Team & Collaboration */}
      <div class='mb-8 space-y-6'>
        <h2 class='text-lg font-semibold text-gray-900'>Team & Collaboration</h2>

        {/* Members Section - Full Width */}
        <div class='rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
          <div class='mb-4 flex items-center justify-between'>
            <h3 class='text-base font-semibold text-gray-900'>Project Members</h3>
            <Show when={isOwner()}>
              <Show
                when={canAddMember()}
                fallback={
                  <span
                    class='inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-500'
                    title='Collaborator limit reached. Upgrade your plan to add more team members.'
                  >
                    <FiPlus class='h-4 w-4' />
                    Add Member
                  </span>
                }
              >
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  class='inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                >
                  <FiPlus class='h-4 w-4' />
                  Add Member
                </button>
              </Show>
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

                  const userProgress = () => getUserProgress(member.userId);

                  return (
                    <div class='p-4'>
                      <div class='flex items-center justify-between'>
                        <div class='flex items-center gap-3'>
                          <Avatar
                            src={
                              member.image ?
                                member.image.startsWith('/') ?
                                  `${API_BASE}${member.image}`
                                : member.image
                              : `${API_BASE}/api/users/avatar/${member.userId}`
                            }
                            name={member.displayName || member.name || member.email}
                            class='h-10 w-10 overflow-hidden rounded-full'
                            fallbackClass='flex items-center justify-center w-full h-full bg-blue-600 text-white font-medium'
                          />
                          <div>
                            <p class='font-medium text-gray-900'>
                              {member.displayName || member.name || 'Unknown'}
                              {isSelf && <span class='ml-1 text-gray-400'>(you)</span>}
                            </p>
                          </div>
                        </div>
                        <div class='flex items-center gap-2'>
                          <span class='inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 capitalize'>
                            {member.role}
                          </span>
                          <Show when={canRemove && !isLastOwner}>
                            <button
                              onClick={() =>
                                handleRemoveMember(
                                  member.userId,
                                  member.displayName || member.name || member.email,
                                )
                              }
                              class='rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                              title={isSelf ? 'Leave project' : 'Remove member'}
                            >
                              <FiTrash2 class='h-4 w-4' />
                            </button>
                          </Show>
                        </div>
                      </div>
                      <Show when={userProgress().total > 0}>
                        <div class='mt-4'>
                          <Progress
                            value={userProgress().percentage}
                            label={`${userProgress().completed} of ${userProgress().total} studies appraised`}
                            showValue={true}
                            size='sm'
                            variant={
                              userProgress().percentage === 100 ? 'success'
                              : userProgress().percentage >= 50 ?
                                'default'
                              : 'warning'
                            }
                          />
                        </div>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </div>

        {/* Reviewer Assignment - Below Members, Collapsed by Default */}
        <Show when={shouldShowReviewerAssignment()}>
          <ReviewerAssignment
            studies={studies}
            members={members}
            onAssignReviewers={handleUpdateStudy}
          />
        </Show>
      </div>

      {/* Section 3: Results */}
      <div class='mb-8 space-y-6'>
        <h2 class='text-lg font-semibold text-gray-900'>Results</h2>

        {/* Figures Section - Collapsible */}
        <div class='overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm'>
          <Collapsible
            open={chartsExpanded()}
            onOpenChange={({ open }) => setChartsExpanded(open)}
            trigger={
              <div class='flex w-full cursor-pointer items-center justify-between px-6 py-4 transition-colors select-none hover:bg-gray-50'>
                <h2 class='text-lg font-semibold text-gray-900'>Figures</h2>
                <div class='text-sm text-gray-500'>
                  {chartsExpanded() ? 'Click to collapse' : 'Click to expand charts'}
                </div>
              </div>
            }
          >
            <div class='border-t border-gray-200 px-6 py-6'>
              <ChartSection studies={studies} members={members} />
            </div>
          </Collapsible>
        </div>
        {/* Tables Section - Collapsible */}
        <div class='overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm'>
          <Collapsible
            open={tablesExpanded()}
            onOpenChange={({ open }) => setTablesExpanded(open)}
            trigger={
              <div class='flex w-full cursor-pointer items-center justify-between px-6 py-4 transition-colors select-none hover:bg-gray-50'>
                <h2 class='text-lg font-semibold text-gray-900'>Tables</h2>
                <div class='text-sm text-gray-500'>
                  {tablesExpanded() ? 'Click to collapse' : 'Click to expand tables'}
                </div>
              </div>
            }
          >
            <div class='border-t border-gray-200 px-6 py-6'>
              <AMSTAR2ResultsTable studies={studies} />
            </div>
          </Collapsible>
        </div>
      </div>
      <AddMemberModal
        isOpen={showAddMemberModal()}
        onClose={() => setShowAddMemberModal(false)}
        projectId={projectId}
        orgId={orgId()}
        quotaInfo={collaboratorQuotaInfo()}
      />
      {/* Remove member confirmation dialog */}
      <AlertDialog open={removeDialogOpen()} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogBackdrop />
        <AlertDialogPositioner>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogIcon variant='danger' />
              <div>
                <AlertDialogTitle>
                  {pendingRemoveMember()?.isSelf ? 'Leave Project' : 'Remove Member'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {pendingRemoveMember()?.isSelf ?
                    'Are you sure you want to leave this project? You will need to be re-invited to rejoin.'
                  : `Are you sure you want to remove ${pendingRemoveMember()?.memberName} from this project?`
                  }
                </AlertDialogDescription>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant='danger' onClick={confirmRemoveMember}>
                {pendingRemoveMember()?.isSelf ? 'Leave Project' : 'Remove'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogPositioner>
      </AlertDialog>
    </>
  );
}
