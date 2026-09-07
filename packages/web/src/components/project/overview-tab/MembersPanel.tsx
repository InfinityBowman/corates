/**
 * MembersPanel - project members with per-member progress, invite, pending
 * invitations, and remove or leave.
 */

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { PlusIcon, XIcon } from 'lucide-react';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { project } from '@/project';
import { showToast } from '@/lib/toast';
import { Avatar, AvatarImage, AvatarFallback, getInitials } from '@/components/ui/avatar';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
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
import { cn } from '@/lib/utils';
import { API_BASE } from '@/config/api';
import { useSubscription } from '@/hooks/useSubscription';
import { useMembers } from '@/hooks/useMembers';
import { useProjectContext, type ProjectMember } from '../ProjectContext';
import { AddMemberModal } from './AddMemberModal';
import { PendingInvitations } from './PendingInvitations';

interface MemberProgress {
  completed: number;
  total: number;
}

interface MembersPanelProps {
  members: ProjectMember[];
  progressFor: (userId: string) => MemberProgress;
}

function DisabledInviteButton({ reason }: { reason: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'xs' }),
            'text-muted-foreground/70 cursor-not-allowed opacity-60',
          )}
          aria-disabled='true'
        >
          <PlusIcon className='size-3.5' />
          Invite
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

export function MembersPanel({ members, progressFor }: MembersPanelProps) {
  const user = useAuthStore(selectUser);
  const navigate = useNavigate();
  const { projectId, orgId, isOwner } = useProjectContext();
  const { hasQuota, quotas } = useSubscription();
  const { members: orgMembers } = useMembers();

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{
    memberId: string;
    memberName: string;
    isSelf: boolean;
  } | null>(null);

  const nonOwnerOrgMemberCount = orgMembers.filter(m => m.role !== 'owner').length;
  const canAddMember =
    isOwner && hasQuota('collaborators.org.max', { used: nonOwnerOrgMemberCount, requested: 1 });
  const ownerCount = members.filter(m => m.role === 'owner').length;

  async function confirmRemove() {
    if (!pendingRemove) return;
    try {
      const result = await project.member.remove(pendingRemove.memberId);
      if (result.isSelf) {
        navigate({ to: '/dashboard', replace: true });
        showToast.success('You left the project', 'You no longer have access to it.');
      } else {
        showToast.success(
          'Member removed',
          `${pendingRemove.memberName} no longer has access to this project.`,
        );
      }
      setPendingRemove(null);
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Could not remove the member' });
    }
  }

  return (
    <section aria-labelledby='overview-members-heading'>
      <div className='mb-2 flex items-center justify-between'>
        <h2 id='overview-members-heading' className='text-muted-foreground text-xs font-semibold'>
          Members
          <span className='ml-1.5 font-medium tabular-nums'>{members.length}</span>
        </h2>
        {!isOwner ?
          <DisabledInviteButton reason='Only the project owner can invite members.' />
        : canAddMember ?
          <Button
            variant='ghost'
            size='xs'
            className='text-primary hover:text-primary'
            onClick={() => setShowAddMemberModal(true)}
          >
            <PlusIcon className='size-3.5' />
            Invite
          </Button>
        : <DisabledInviteButton reason='Collaborator limit reached. Upgrade your plan to add more team members.' />
        }
      </div>

      <div className='flex flex-col gap-1'>
        {members.map(member => {
          const isSelf = user?.id === member.userId;
          const isLastOwner = member.role === 'owner' && ownerCount <= 1;
          const canRemove = (isOwner || isSelf) && !isLastOwner;
          const name = member.name || member.email || 'Unknown';
          const progress = progressFor(member.userId);

          return (
            <div key={member.userId} className='flex items-center gap-2 py-1 text-sm'>
              <Avatar size='sm' className='size-6'>
                <AvatarImage
                  src={
                    member.image ?
                      member.image.startsWith('/') ?
                        `${API_BASE}${member.image}`
                      : member.image
                    : undefined
                  }
                  alt=''
                />
                <AvatarFallback className='text-[10px]'>{getInitials(name)}</AvatarFallback>
              </Avatar>
              <div className='min-w-0 flex-1'>
                <div className='text-foreground truncate'>
                  {member.name || 'Unknown'}
                  {isSelf && <span className='text-muted-foreground'> (you)</span>}
                </div>
                {progress.total > 0 && (
                  <div className='text-muted-foreground text-xs tabular-nums'>
                    {progress.completed} of {progress.total} studies done
                  </div>
                )}
              </div>
              <span className='text-muted-foreground shrink-0 text-xs'>
                {member.role === 'owner' ? 'Lead' : 'Reviewer'}
              </span>
              {canRemove ?
                <Button
                  variant='ghost'
                  size='icon-xs'
                  onClick={() =>
                    setPendingRemove({ memberId: member.userId, memberName: name, isSelf })
                  }
                  className='text-muted-foreground hover:text-destructive'
                  aria-label={isSelf ? 'Leave project' : 'Remove member'}
                >
                  <XIcon className='size-3.5' />
                </Button>
              : <span className='size-6 shrink-0' />}
            </div>
          );
        })}
      </div>

      <PendingInvitations projectId={projectId} orgId={orgId} isOwner={isOwner} />

      <AddMemberModal
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        projectId={projectId}
        orgId={orgId}
        quotaInfo={{ used: nonOwnerOrgMemberCount, max: quotas?.['collaborators.org.max'] ?? 0 }}
      />

      <AlertDialog
        open={pendingRemove !== null}
        onOpenChange={open => {
          if (!open) setPendingRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogIcon variant='danger' />
            <div>
              <AlertDialogTitle>
                {pendingRemove?.isSelf ? 'Leave this project?' : 'Remove this member?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingRemove?.isSelf ?
                  'You lose access to this project straight away. The checklists you completed stay with the project. Rejoining takes a new invitation from the owner.'
                : `${pendingRemove?.memberName} loses access to this project straight away. Their completed checklists stay with the project, and any study still assigned to them will need a new reviewer. Rejoining takes a new invitation.`
                }
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={confirmRemove}>
              {pendingRemove?.isSelf ? 'Leave project' : 'Remove member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
