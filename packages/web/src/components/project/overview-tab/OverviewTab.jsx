import { For, Show, createSignal, createMemo } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { FiPlus, FiTrash2, FiChevronDown } from 'solid-icons/fi';
import { AiOutlineBook } from 'solid-icons/ai';
import { BiRegularCheckCircle } from 'solid-icons/bi';
import { CgArrowsExchange } from 'solid-icons/cg';
import ChartSection from './ChartSection.jsx';
import AddMemberModal from './AddMemberModal.jsx';
import AMSTAR2ResultsTable from './AMSTAR2ResultsTable.jsx';
import projectStore from '@/stores/projectStore.js';
import projectActionsStore from '@/stores/projectActionsStore';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useProjectContext } from '../ProjectContext.jsx';
import { showToast } from '@/components/ui/toast';
import { Avatar, AvatarImage, AvatarFallback, getInitials } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipTrigger,
  TooltipPositioner,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  CollapsibleIndicator,
} from '@/components/ui/collapsible';
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
  const { members: orgMembers } = useMembers();

  // Read from store directly
  const studies = () => projectStore.getStudies(projectId);
  const members = () => projectStore.getMembers(projectId);
  const currentUserId = () => user()?.id;

  // Count non-owner org members (matches backend checkCollaboratorQuota)
  const nonOwnerOrgMemberCount = () => orgMembers().filter(m => m.role !== 'owner').length;

  // Check if can add more collaborators (quota check)
  const collaboratorQuotaInfo = createMemo(() => {
    const max = quotas()?.['collaborators.org.max'] ?? 0;
    const used = nonOwnerOrgMemberCount();
    return { used, max };
  });

  const canAddMember = createMemo(() => {
    if (!isOwner()) return false;
    return hasQuota('collaborators.org.max', { used: nonOwnerOrgMemberCount(), requested: 1 });
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

  return (
    <>
      {/* Section 1: Project Progress - Hero Section */}
      <div class='border-border bg-card mb-6 rounded-xl border p-5'>
        <h2 class='text-foreground mb-5 text-base font-semibold'>Project Progress</h2>

        <div class='mb-5 flex flex-col items-center md:flex-row md:items-start md:gap-8'>
          {/* Overall Progress - Circular */}
          <div class='mb-5 md:mb-0'>
            <CircularProgress
              value={overallProgress()}
              showValue={true}
              variant={
                overallProgress() === 100 ? 'success'
                : overallProgress() >= 50 ?
                  'default'
                : 'warning'
              }
              size={140}
            />
            <p class='text-muted-foreground mt-3 text-center text-sm'>
              {completedStudies()} of {studies().length} studies completed
            </p>
          </div>

          {/* Enhanced Stats Grid */}
          <div class='grid flex-1 grid-cols-2 gap-3 md:grid-cols-3'>
            <div class='border-border bg-muted rounded-lg border p-4 text-center'>
              <div class='mb-2 flex justify-center'>
                <AiOutlineBook class='text-muted-foreground h-5 w-5' />
              </div>
              <p class='text-foreground text-2xl font-bold'>{studies().length}</p>
              <p class='text-muted-foreground mt-1 text-xs font-medium'>Total Studies</p>
            </div>
            <div class='rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center'>
              <div class='mb-2 flex justify-center'>
                <CgArrowsExchange class='h-5 w-5 text-emerald-600' />
              </div>
              <p class='text-2xl font-bold text-emerald-700'>{readyToReconcile()}</p>
              <p class='mt-1 text-xs font-medium text-emerald-600'>Ready to Reconcile</p>
            </div>
            <div class='rounded-lg border border-blue-200 bg-blue-50 p-4 text-center'>
              <div class='mb-2 flex justify-center'>
                <BiRegularCheckCircle class='h-5 w-5 text-blue-600' />
              </div>
              <p class='text-2xl font-bold text-blue-700'>{completedStudies()}</p>
              <p class='mt-1 text-xs font-medium text-blue-600'>Completed</p>
            </div>
          </div>
        </div>

        {/* Inter-rater Reliability Section */}
        <Show when={interRaterMetrics().studyCount > 0}>
          <div class='border-border bg-muted mt-5 rounded-lg border p-4'>
            <h3 class='text-foreground mb-4 text-sm font-semibold'>Inter-rater Reliability</h3>
            <div class='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <div class='text-center'>
                <p class='text-foreground text-2xl font-bold'>{interRaterMetrics().studyCount}</p>
                <p class='text-muted-foreground mt-1 text-xs'>Studies Included</p>
              </div>
              <div class='text-center'>
                <p class='text-2xl font-bold text-emerald-600'>
                  {interRaterMetrics().percentAgreement != null ?
                    `${interRaterMetrics().percentAgreement.toFixed(1)}%`
                  : 'N/A'}
                </p>
                <p class='text-muted-foreground mt-1 text-xs'>Percent Agreement</p>
              </div>
              <div class='text-center'>
                <p class='text-2xl font-bold text-blue-600'>
                  {interRaterMetrics().cohensKappa != null ?
                    interRaterMetrics().cohensKappa.toFixed(3)
                  : 'N/A'}
                </p>
                <p class='text-muted-foreground mt-1 text-xs'>
                  Cohen's Kappa ({getKappaInterpretation(interRaterMetrics().cohensKappa)})
                </p>
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Section 2: Team Members */}
      <div class='border-border bg-card mb-6 rounded-xl border p-5'>
        <div class='mb-4 flex items-center justify-between'>
          <h3 class='text-foreground text-base font-semibold'>Team Members ({members().length})</h3>
          <Show when={isOwner()}>
            <Show
              when={canAddMember()}
              fallback={
                <Tooltip openDelay={200} closeDelay={0}>
                  <TooltipTrigger
                    asChild={item => (
                      <span
                        {...item}
                        class='bg-secondary text-muted-foreground/70 inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium'
                      >
                        <FiPlus class='h-4 w-4' />
                        Invite
                      </span>
                    )}
                  />
                  <TooltipPositioner>
                    <TooltipContent>
                      Collaborator limit reached. Upgrade your plan to add more team members.
                    </TooltipContent>
                  </TooltipPositioner>
                </Tooltip>
              }
            >
              <button
                onClick={() => setShowAddMemberModal(true)}
                class='bg-primary hover:bg-primary/90 focus:ring-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none'
              >
                <FiPlus class='h-4 w-4' />
                Invite
              </button>
            </Show>
          </Show>
        </div>
        <Show when={members().length > 0}>
          <div class='space-y-2'>
            <For each={members()}>
              {(member, index) => {
                const isSelf = currentUserId() === member.userId;
                const canRemove = isOwner() || isSelf;
                const isLastOwner =
                  member.role === 'owner' && members().filter(m => m.role === 'owner').length <= 1;

                const userProgress = () => getUserProgress(member.userId);

                return (
                  <div
                    class='flex items-center justify-between rounded-lg p-3 transition-colors'
                    style={{ background: index() % 2 === 0 ? '#f8fafc' : 'transparent' }}
                  >
                    <div class='flex items-center gap-3'>
                      <Avatar class='h-9 w-9'>
                        <AvatarImage
                          src={
                            member.image ?
                              member.image.startsWith('/') ?
                                `${API_BASE}${member.image}`
                              : member.image
                            : undefined
                          }
                          alt={member.name || member.email}
                        />
                        <AvatarFallback class='bg-primary text-white'>
                          {getInitials(member.name || member.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p class='text-foreground font-medium'>
                          {member.name || 'Unknown'}
                          {isSelf && <span class='text-muted-foreground/70 ml-1'>(you)</span>}
                        </p>
                        <Show when={userProgress().total > 0}>
                          <p class='text-muted-foreground text-xs'>
                            {userProgress().completed}/{userProgress().total} studies completed
                          </p>
                        </Show>
                      </div>
                    </div>
                    <div class='flex items-center gap-2'>
                      <span class='inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 capitalize'>
                        {member.role}
                      </span>
                      <Show when={canRemove && !isLastOwner}>
                        <button
                          onClick={() =>
                            handleRemoveMember(member.userId, member.name || member.email)
                          }
                          class='text-muted-foreground/70 focus:ring-primary rounded p-1.5 transition-colors hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:outline-none'
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

      {/* Section 3: Results */}
      <div class='space-y-4'>
        {/* Figures Section - Collapsible */}
        <div class='border-border bg-card overflow-hidden rounded-xl border'>
          <Collapsible open={chartsExpanded()} onOpenChange={setChartsExpanded}>
            <CollapsibleTrigger class='hover:bg-muted w-full cursor-pointer justify-between px-5 py-4 transition-colors select-none'>
              <h2 class='text-foreground text-base font-semibold'>Figures</h2>
              <div class='text-muted-foreground flex items-center gap-2 text-sm'>
                {chartsExpanded() ? 'Click to collapse' : 'Click to expand'}
                <CollapsibleIndicator>
                  <FiChevronDown class='h-4 w-4' />
                </CollapsibleIndicator>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div class='border-border-subtle border-t px-5 py-5'>
                <ChartSection studies={studies} members={members} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        {/* Tables Section - Collapsible */}
        <div class='border-border bg-card overflow-hidden rounded-xl border'>
          <Collapsible open={tablesExpanded()} onOpenChange={setTablesExpanded}>
            <CollapsibleTrigger class='hover:bg-muted w-full cursor-pointer justify-between px-5 py-4 transition-colors select-none'>
              <h2 class='text-foreground text-base font-semibold'>Tables</h2>
              <div class='text-muted-foreground flex items-center gap-2 text-sm'>
                {tablesExpanded() ? 'Click to collapse' : 'Click to expand'}
                <CollapsibleIndicator>
                  <FiChevronDown class='h-4 w-4' />
                </CollapsibleIndicator>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div class='border-border-subtle border-t px-5 py-5'>
                <AMSTAR2ResultsTable studies={studies} />
              </div>
            </CollapsibleContent>
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
