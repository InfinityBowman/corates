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
import { useAllStudies, useProjectMembers } from '@/project/workspace-data';
import { project } from '@/project';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { useProjectContext, type ProjectMember } from '../ProjectContext';
import { showToast } from '@/lib/toast';
import { Avatar, AvatarImage, AvatarFallback, getInitials } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
import {
  CHECKLIST_STATUS,
  shouldShowInTab,
  getReadyReconciliationPairs,
} from '@corates/shared/checklists';
import {
  calculateInterRaterReliability,
  getKappaInterpretation,
  type InterRaterMetrics,
} from '@/lib/inter-rater-reliability.js';
import { CircularProgress } from './CircularProgress';
import { ChartSection } from './ChartSection';
import { ResultsTables } from './ResultsTables';
import { AddMemberModal } from './AddMemberModal';
import { PendingInvitations } from './PendingInvitations';
import { useSubscription } from '@/hooks/useSubscription';
import { useMembers } from '@/hooks/useMembers';

function DisabledInviteButton({ reason }: { reason: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            buttonVariants({ variant: 'secondary' }),
            'text-muted-foreground/70 hover:bg-secondary cursor-not-allowed opacity-50',
          )}
          aria-disabled='true'
        >
          <PlusIcon className='size-4' />
          Invite
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

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

  const studies = useAllStudies(projectId);
  const members = useProjectMembers(projectId);

  const nonOwnerOrgMemberCount = useMemo(
    () => orgMembers.filter(m => m.role !== 'owner').length,
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
    () => studies.filter(s => getReadyReconciliationPairs(s).length > 0).length,
    [studies],
  );

  const completedStudies = useMemo(
    () => studies.filter(s => shouldShowInTab(s, 'completed', null)).length,
    [studies],
  );

  const overallProgress = useMemo(() => {
    const total = studies.length;
    if (total === 0) return 0;
    return Math.round((completedStudies / total) * 100);
  }, [studies, completedStudies]);

  const userProgressMap = useMemo(() => {
    const progressMap = new Map<string, { completed: number; total: number }>();

    studies.forEach(study => {
      const assignedUserIds: string[] = [];
      if (study.reviewer1) assignedUserIds.push(study.reviewer1);
      if (study.reviewer2) assignedUserIds.push(study.reviewer2);

      assignedUserIds.forEach(userId => {
        if (!progressMap.has(userId)) progressMap.set(userId, { completed: 0, total: 0 });
        const progress = progressMap.get(userId)!;
        progress.total++;
        const checklists = study.checklists || [];
        const hasCompleted = checklists
          .filter(c => c.assignedTo === userId)
          .some(
            c =>
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
      const result = await project.member.remove(pendingRemoveMember.memberId);
      if (result.isSelf) {
        navigate({ to: '/dashboard', replace: true });
        showToast.success('You left the project', 'You no longer have access to it.');
      } else {
        showToast.success(
          'Member removed',
          `${pendingRemoveMember.memberName} no longer has access to this project.`,
        );
      }
      setRemoveDialogOpen(false);
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Could not remove the member' });
    }
  }, [pendingRemoveMember, navigate]);

  const interRaterMetrics: InterRaterMetrics = useMemo(() => {
    // getData throws while the pool has no active connection (a cold refresh
    // renders this tab from cached rows before the gate's effects run) —
    // treat that window as "no data" rather than crashing into the section
    // error boundary.
    const getChecklistData = (studyId: string, checklistId: string) => {
      try {
        return project.checklist.getData(studyId, checklistId);
      } catch {
        return null;
      }
    };
    return calculateInterRaterReliability(studies, getChecklistData);
  }, [studies]);

  return (
    <>
      {/* Project Progress */}
      <div className='border-border bg-card mb-6 rounded-xl border p-5'>
        <h2 className='text-foreground mb-5 text-base font-semibold'>Project progress</h2>

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
              {completedStudies} of {studies.length} studies reconciled and finalized
            </p>
          </div>

          <div className='grid flex-1 grid-cols-2 gap-3 md:grid-cols-3'>
            <div className='border-border bg-muted rounded-lg border p-4 text-center'>
              <div className='mb-2 flex justify-center'>
                <BookOpenIcon className='text-muted-foreground size-5' />
              </div>
              <p className='text-foreground text-2xl font-bold'>{studies.length}</p>
              <p className='text-muted-foreground mt-1 text-xs font-medium'>Total studies</p>
            </div>
            <div className='border-success-border bg-success-bg rounded-lg border p-4 text-center'>
              <div className='mb-2 flex justify-center'>
                <ArrowRightLeftIcon className='text-success size-5' />
              </div>
              <p className='text-success text-2xl font-bold'>{readyToReconcile}</p>
              <p className='text-success mt-1 text-xs font-medium'>Ready to reconcile</p>
            </div>
            <div className='border-info-border bg-info-bg rounded-lg border p-4 text-center'>
              <div className='mb-2 flex justify-center'>
                <CheckCircleIcon className='text-info size-5' />
              </div>
              <p className='text-info text-2xl font-bold'>{completedStudies}</p>
              <p className='text-info mt-1 text-xs font-medium'>Completed</p>
            </div>
          </div>
        </div>

        {/* Inter-rater Reliability */}
        {interRaterMetrics.studyCount > 0 && (
          <div className='border-border bg-muted mt-5 rounded-lg border p-4'>
            <h3 className='text-foreground mb-4 text-sm font-semibold'>Inter-rater reliability</h3>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <div className='text-center'>
                <p className='text-foreground text-2xl font-bold'>{interRaterMetrics.studyCount}</p>
                <p className='text-muted-foreground mt-1 text-xs'>Studies included</p>
              </div>
              <div className='text-center'>
                <p className='text-success text-2xl font-bold'>
                  {interRaterMetrics.percentAgreement != null ?
                    `${interRaterMetrics.percentAgreement.toFixed(1)}%`
                  : 'N/A'}
                </p>
                <p className='text-muted-foreground mt-1 text-xs'>Percent agreement</p>
              </div>
              <div className='text-center'>
                <p className='text-info text-2xl font-bold'>
                  {interRaterMetrics.cohensKappa != null ?
                    interRaterMetrics.cohensKappa.toFixed(3)
                  : 'N/A'}
                </p>
                <p className='text-muted-foreground mt-1 text-xs'>
                  Cohen&apos;s kappa ({getKappaInterpretation(interRaterMetrics.cohensKappa)})
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
            Team members ({members.length})
          </h3>
          {!isOwner ?
            <DisabledInviteButton reason='Only the project owner can invite members.' />
          : canAddMember ?
            <Button onClick={() => setShowAddMemberModal(true)}>
              <PlusIcon className='size-4' />
              Invite
            </Button>
          : <DisabledInviteButton reason='Collaborator limit reached. Upgrade your plan to add more team members.' />
          }
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
                    <Badge variant='info' className='capitalize'>
                      {member.role}
                    </Badge>
                    {canRemove && !isLastOwner && (
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        onClick={() =>
                          handleRemoveMember(
                            member.userId,
                            member.name || member.email || 'Unknown',
                          )
                        }
                        className='text-muted-foreground hover:text-red-600'
                        title={isSelf ? 'Leave project' : 'Remove member'}
                        aria-label={isSelf ? 'Leave project' : 'Remove member'}
                      >
                        <Trash2Icon className='size-4' />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <PendingInvitations projectId={projectId} orgId={orgId} isOwner={isOwner} />
      </div>

      {/* Results */}
      <div className='flex flex-col gap-4'>
        <div className='border-border bg-card overflow-hidden rounded-xl border'>
          <Collapsible open={chartsExpanded} onOpenChange={setChartsExpanded}>
            <CollapsibleTrigger className='hover:bg-muted focus-visible:ring-primary flex w-full cursor-pointer items-center justify-between rounded-t-xl px-5 py-4 transition-colors select-none focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset data-[state=closed]:rounded-b-xl'>
              <h2 className='text-foreground text-base font-semibold'>Figures</h2>
              <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                {chartsExpanded ? 'Click to collapse' : 'Click to expand'}
                <ChevronDownIcon
                  className={`size-4 transition-transform ${chartsExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className='border-border border-t bg-[#fbfbfc] px-5 pt-[18px] pb-[22px]'>
                <ChartSection studies={studies} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <div className='border-border bg-card overflow-hidden rounded-xl border'>
          <Collapsible open={tablesExpanded} onOpenChange={setTablesExpanded}>
            <CollapsibleTrigger className='hover:bg-muted focus-visible:ring-primary flex w-full cursor-pointer items-center justify-between rounded-t-xl px-5 py-4 transition-colors select-none focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset data-[state=closed]:rounded-b-xl'>
              <h2 className='text-foreground text-base font-semibold'>Tables</h2>
              <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                {tablesExpanded ? 'Click to collapse' : 'Click to expand'}
                <ChevronDownIcon
                  className={`size-4 transition-transform ${tablesExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className='border-border border-t bg-[#fbfbfc] px-5 pt-[18px] pb-[22px]'>
                <ResultsTables studies={studies} />
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
                {pendingRemoveMember?.isSelf ? 'Leave this project?' : 'Remove this member?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingRemoveMember?.isSelf ?
                  'You lose access to this project straight away. The appraisals you completed stay with the project. Rejoining takes a new invitation from the owner.'
                : `${pendingRemoveMember?.memberName} loses access to this project straight away. Their completed appraisals stay with the project, and any study still assigned to them will need a new reviewer. Rejoining takes a new invitation.`
                }
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={confirmRemoveMember}>
              {pendingRemoveMember?.isSelf ? 'Leave project' : 'Remove member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
