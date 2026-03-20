/**
 * OverviewTab - Project overview with stats, team members, charts, and tables
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  PlusIcon,
  Trash2Icon,
  ChevronDownIcon,
  BookOpenIcon,
  ArrowRightLeftIcon,
  CheckCircleIcon,
} from 'lucide-react';
import { useProjectStore, selectStudies, selectMembers } from '@/stores/projectStore';
import _projectActionsStore from '@/stores/projectActionsStore/index.js';
const projectActionsStore = _projectActionsStore as any;
import { useAuthStore, selectUser } from '@/stores/authStore';
import { useProjectContext, type ProjectMember } from '../ProjectContext';
import { showToast } from '@/components/ui/toast';
import { Avatar, AvatarImage, AvatarFallback, getInitials } from '@/components/ui/avatar';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { API_BASE } from '@/config/api';
import { CHECKLIST_STATUS } from '@/constants/checklist-status';
import { shouldShowInTab, isReconciledChecklist } from '@/lib/checklist-domain.js';
import {
  calculateInterRaterReliability,
  getKappaInterpretation,
} from '@/lib/inter-rater-reliability.js';
import { CircularProgress } from './CircularProgress';
import { ChartSection } from './ChartSection';
import { AMSTAR2ResultsTable } from './AMSTAR2ResultsTable';
import { AddMemberModal } from './AddMemberModal';
import { useSubscription } from '@/hooks/useSubscription';
import { useMembers } from '@/hooks/useMembers';

export function OverviewTab() {
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [chartsExpanded, setChartsExpanded] = useState(false);
  const [tablesExpanded, setTablesExpanded] = useState(false);

  const user = useAuthStore(selectUser);
  const { projectId, orgId, isOwner } = useProjectContext();
  const navigate = useNavigate();

  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [pendingRemoveMember, setPendingRemoveMember] = useState<{
    memberId: string;
    memberName: string;
    isSelf: boolean;
  } | null>(null);

  const { hasQuota, quotas } = useSubscription();
  const { members: orgMembers } = useMembers();

  const studies = useProjectStore(s => selectStudies(s, projectId));
  const members = useProjectStore(s => selectMembers(s, projectId)) as ProjectMember[];

  const nonOwnerOrgMemberCount = useMemo(
    () => orgMembers.filter((m: any) => m.role !== 'owner').length,
    [orgMembers],
  );

  const collaboratorQuotaInfo = useMemo(
    () => ({
      used: nonOwnerOrgMemberCount,
      max: quotas?.['collaborators.org.max'] ?? 0,
    }),
    [nonOwnerOrgMemberCount, quotas],
  );

  const canAddMember = useMemo(() => {
    if (!isOwner) return false;
    return hasQuota('collaborators.org.max', { used: nonOwnerOrgMemberCount, requested: 1 });
  }, [isOwner, hasQuota, nonOwnerOrgMemberCount]);

  const readyToReconcile = useMemo(
    () =>
      studies.filter((s: any) => {
        const checklists = s.checklists || [];
        const awaitingReconcile = checklists.filter(
          (c: any) => !isReconciledChecklist(c) && c.status === CHECKLIST_STATUS.REVIEWER_COMPLETED,
        );
        return awaitingReconcile.length === 2;
      }).length,
    [studies],
  );

  const completedStudies = useMemo(
    () => studies.filter((s: any) => shouldShowInTab(s, 'completed', null)).length,
    [studies],
  );

  const overallProgress = useMemo(() => {
    const total = studies.length;
    if (total === 0) return 0;
    return Math.round((completedStudies / total) * 100);
  }, [studies, completedStudies]);

  const userProgressMap = useMemo(() => {
    const progressMap = new Map<string, { completed: number; total: number }>();

    studies.forEach((study: any) => {
      const assignedUserIds: string[] = [];
      if (study.reviewer1) assignedUserIds.push(study.reviewer1);
      if (study.reviewer2) assignedUserIds.push(study.reviewer2);

      assignedUserIds.forEach(userId => {
        if (!progressMap.has(userId)) progressMap.set(userId, { completed: 0, total: 0 });
        const progress = progressMap.get(userId)!;
        progress.total++;
        const checklists = study.checklists || [];
        const hasCompleted = checklists
          .filter((c: any) => c.assignedTo === userId)
          .some(
            (c: any) =>
              c.status === CHECKLIST_STATUS.FINALIZED ||
              c.status === CHECKLIST_STATUS.REVIEWER_COMPLETED,
          );
        if (hasCompleted) progress.completed++;
      });
    });

    const result = new Map<string, { percentage: number; completed: number; total: number }>();
    progressMap.forEach((p, userId) => {
      result.set(userId, {
        percentage: p.total === 0 ? 0 : Math.round((p.completed / p.total) * 100),
        completed: p.completed,
        total: p.total,
      });
    });
    return result;
  }, [studies]);

  const getUserProgress = (userId: string) =>
    userProgressMap.get(userId) || { percentage: 0, completed: 0, total: 0 };

  const handleRemoveMember = useCallback(
    (memberId: string, memberName: string) => {
      const isSelf = user?.id === memberId;
      setPendingRemoveMember({ memberId, memberName, isSelf: !!isSelf });
      setRemoveDialogOpen(true);
    },
    [user?.id],
  );

  const confirmRemoveMember = useCallback(async () => {
    if (!pendingRemoveMember) return;
    try {
      const result = await projectActionsStore.member.remove(pendingRemoveMember.memberId);
      if (result.isSelf) {
        navigate({ to: '/dashboard', replace: true });
        showToast.success('Left Project', 'You have left the project');
      } else {
        showToast.success(
          'Member Removed',
          `${pendingRemoveMember.memberName} has been removed from the project`,
        );
      }
      setRemoveDialogOpen(false);
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Remove Failed' });
    }
  }, [pendingRemoveMember, navigate]);

  const interRaterMetrics: any = useMemo(() => {
    const getChecklistData = (studyId: string, checklistId: string) =>
      projectActionsStore.checklist.getData(studyId, checklistId);
    return calculateInterRaterReliability(studies, getChecklistData);
  }, [studies]);

  return (
    <>
      {/* Project Progress */}
      <div className='border-border bg-card mb-6 rounded-xl border p-5'>
        <h2 className='text-foreground mb-5 text-base font-semibold'>Project Progress</h2>

        <div className='mb-5 flex flex-col items-center md:flex-row md:items-start md:gap-8'>
          <div className='mb-5 md:mb-0'>
            <CircularProgress
              value={overallProgress}
              showValue
              variant={
                overallProgress === 100 ? 'success'
                : overallProgress >= 50 ?
                  'default'
                : 'warning'
              }
              size={140}
            />
            <p className='text-muted-foreground mt-3 text-center text-sm'>
              {completedStudies} of {studies.length} studies completed
            </p>
          </div>

          <div className='grid flex-1 grid-cols-2 gap-3 md:grid-cols-3'>
            <div className='border-border bg-muted rounded-lg border p-4 text-center'>
              <div className='mb-2 flex justify-center'>
                <BookOpenIcon className='text-muted-foreground size-5' />
              </div>
              <p className='text-foreground text-2xl font-bold'>{studies.length}</p>
              <p className='text-muted-foreground mt-1 text-xs font-medium'>Total Studies</p>
            </div>
            <div className='border-success-border bg-success-bg rounded-lg border p-4 text-center'>
              <div className='mb-2 flex justify-center'>
                <ArrowRightLeftIcon className='text-success size-5' />
              </div>
              <p className='text-success text-2xl font-bold'>{readyToReconcile}</p>
              <p className='text-success mt-1 text-xs font-medium'>Ready to Reconcile</p>
            </div>
            <div className='rounded-lg border border-blue-200 bg-blue-50 p-4 text-center'>
              <div className='mb-2 flex justify-center'>
                <CheckCircleIcon className='size-5 text-blue-600' />
              </div>
              <p className='text-2xl font-bold text-blue-700'>{completedStudies}</p>
              <p className='mt-1 text-xs font-medium text-blue-600'>Completed</p>
            </div>
          </div>
        </div>

        {/* Inter-rater Reliability */}
        {interRaterMetrics.studyCount > 0 && (
          <div className='border-border bg-muted mt-5 rounded-lg border p-4'>
            <h3 className='text-foreground mb-4 text-sm font-semibold'>Inter-rater Reliability</h3>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <div className='text-center'>
                <p className='text-foreground text-2xl font-bold'>{interRaterMetrics.studyCount}</p>
                <p className='text-muted-foreground mt-1 text-xs'>Studies Included</p>
              </div>
              <div className='text-center'>
                <p className='text-success text-2xl font-bold'>
                  {interRaterMetrics.percentAgreement != null ?
                    `${interRaterMetrics.percentAgreement.toFixed(1)}%`
                  : 'N/A'}
                </p>
                <p className='text-muted-foreground mt-1 text-xs'>Percent Agreement</p>
              </div>
              <div className='text-center'>
                <p className='text-2xl font-bold text-blue-600'>
                  {interRaterMetrics.cohensKappa != null ?
                    interRaterMetrics.cohensKappa.toFixed(3)
                  : 'N/A'}
                </p>
                <p className='text-muted-foreground mt-1 text-xs'>
                  Cohen&apos;s Kappa ({getKappaInterpretation(interRaterMetrics.cohensKappa)})
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Team Members */}
      <div className='border-border bg-card mb-6 rounded-xl border p-5'>
        <div className='mb-4 flex items-center justify-between'>
          <h3 className='text-foreground text-base font-semibold'>
            Team Members ({members.length})
          </h3>
          {isOwner &&
            (canAddMember ?
              <button
                onClick={() => setShowAddMemberModal(true)}
                className='bg-primary hover:bg-primary/90 focus:ring-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none'
              >
                <PlusIcon className='size-4' />
                Invite
              </button>
            : <Tooltip>
                <TooltipTrigger asChild>
                  <span className='bg-secondary text-muted-foreground/70 inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium'>
                    <PlusIcon className='size-4' />
                    Invite
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Collaborator limit reached. Upgrade your plan to add more team members.
                </TooltipContent>
              </Tooltip>)}
        </div>
        {members.length > 0 && (
          <div className='flex flex-col gap-2'>
            {members.map((member: ProjectMember, index: number) => {
              const isSelf = user?.id === member.userId;
              const canRemove = isOwner || isSelf;
              const isLastOwner =
                member.role === 'owner' && members.filter(m => m.role === 'owner').length <= 1;
              const progress = getUserProgress(member.userId);

              return (
                <div
                  key={member.userId}
                  className='flex items-center justify-between rounded-lg p-3 transition-colors'
                  style={{ background: index % 2 === 0 ? 'var(--muted)' : 'transparent' }}
                >
                  <div className='flex items-center gap-3'>
                    <Avatar className='size-9'>
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
                      <AvatarFallback className='bg-primary text-white'>
                        {getInitials(member.name || member.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className='text-foreground font-medium'>
                        {member.name || 'Unknown'}
                        {isSelf && <span className='text-muted-foreground/70 ml-1'>(you)</span>}
                      </p>
                      {progress.total > 0 && (
                        <p className='text-muted-foreground text-xs'>
                          {progress.completed}/{progress.total} studies completed
                        </p>
                      )}
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <span className='inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 capitalize'>
                      {member.role}
                    </span>
                    {canRemove && !isLastOwner && (
                      <button
                        onClick={() =>
                          handleRemoveMember(
                            member.userId,
                            member.name || member.email || 'Unknown',
                          )
                        }
                        className='text-muted-foreground/70 focus:ring-primary rounded p-1.5 transition-colors hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:outline-none'
                        title={isSelf ? 'Leave project' : 'Remove member'}
                      >
                        <Trash2Icon className='size-4' />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Results */}
      <div className='flex flex-col gap-4'>
        <div className='border-border bg-card overflow-hidden rounded-xl border'>
          <Collapsible open={chartsExpanded} onOpenChange={setChartsExpanded}>
            <CollapsibleTrigger className='hover:bg-muted flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none'>
              <h2 className='text-foreground text-base font-semibold'>Figures</h2>
              <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                {chartsExpanded ? 'Click to collapse' : 'Click to expand'}
                <ChevronDownIcon
                  className={`size-4 transition-transform ${chartsExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className='border-border border-t px-5 py-5'>
                <ChartSection studies={studies} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <div className='border-border bg-card overflow-hidden rounded-xl border'>
          <Collapsible open={tablesExpanded} onOpenChange={setTablesExpanded}>
            <CollapsibleTrigger className='hover:bg-muted flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none'>
              <h2 className='text-foreground text-base font-semibold'>Tables</h2>
              <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                {tablesExpanded ? 'Click to collapse' : 'Click to expand'}
                <ChevronDownIcon
                  className={`size-4 transition-transform ${tablesExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className='border-border border-t px-5 py-5'>
                <AMSTAR2ResultsTable studies={studies} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <AddMemberModal
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        projectId={projectId}
        orgId={orgId}
        quotaInfo={collaboratorQuotaInfo}
      />

      {/* Remove member confirmation */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogIcon variant='danger' />
            <div>
              <AlertDialogTitle>
                {pendingRemoveMember?.isSelf ? 'Leave Project' : 'Remove Member'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingRemoveMember?.isSelf ?
                  'Are you sure you want to leave this project? You will need to be re-invited to rejoin.'
                : `Are you sure you want to remove ${pendingRemoveMember?.memberName} from this project?`
                }
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={confirmRemoveMember}>
              {pendingRemoveMember?.isSelf ? 'Leave Project' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
