/**
 * Workspace settings > Members: who holds a seat, and the only way to free one.
 * Removing someone from a project keeps them in the workspace (and counted);
 * removing them here takes them off every project in it. Owner only.
 */

import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { MailIcon, UsersIcon } from 'lucide-react';
import { isUnlimitedQuota } from '@corates/shared/plans';
import { API_BASE } from '@/config/api';
import { Avatar, AvatarImage, AvatarFallback, getInitials } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { SettingsPage, SettingsSection, SettingsRow } from '@/components/settings/primitives';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { useCurrentWorkspace, type Workspace } from '@/hooks/useWorkspaces';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { queryKeys } from '@/lib/queryKeys';
import { showToast } from '@/lib/toast';
import { workspaceSettingsPath } from '@/lib/workspacePaths';
import { removeWorkspaceMember } from '@/server/functions/workspaces.functions';
import { cancelInvitation } from '@/server/functions/org-projects.functions';
import { OwnerOnlyNotice } from './OwnerOnlyNotice';

type Member = ReturnType<typeof useWorkspaceMembers>['members'][number];
type PendingInvitation = ReturnType<typeof useWorkspaceMembers>['pendingInvitations'][number];

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function formatDate(value: Date | string | number | null) {
  if (!value) return '';
  const date =
    value instanceof Date ? value
    : typeof value === 'number' ? new Date(value * 1000)
    : new Date(value);
  return dateFormat.format(date);
}

function avatarSrc(image: string | null) {
  if (!image) return undefined;
  return image.startsWith('/') ? `${API_BASE}${image}` : image;
}

function projectList(projects: { name: string }[]) {
  if (projects.length === 0) return 'Not on any project';
  const names = projects.map(p => p.name);
  return `On ${projects.length} project${projects.length === 1 ? '' : 's'}: ${names.join(', ')}`;
}

export function WorkspaceMembersSettings() {
  const { workspace } = useCurrentWorkspace();
  if (!workspace) return null;
  if (workspace.role !== 'owner') return <OwnerOnlyNotice title='Members' />;
  return <MembersPage key={workspace.id} workspace={workspace} />;
}

function MembersPage({ workspace }: { workspace: Workspace }) {
  const user = useAuthStore(selectUser);
  const queryClient = useQueryClient();
  const { members, pendingInvitations, seats } = useWorkspaceMembers(workspace.id);
  const [pendingRemove, setPendingRemove] = useState<Member | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspace.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    const name = pendingRemove.name || pendingRemove.email;
    try {
      await removeWorkspaceMember({ data: { orgId: workspace.id, userId: pendingRemove.userId } });
      showToast.success('Member removed', `${name} no longer has a seat in ${workspace.name}.`);
      refresh();
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Could not remove the member' });
    } finally {
      setPendingRemove(null);
    }
  }

  async function handleCancel(invitation: PendingInvitation) {
    setCancellingId(invitation.id);
    try {
      await cancelInvitation({
        data: {
          orgId: workspace.id,
          projectId: invitation.projectId,
          invitationId: invitation.id,
        },
      });
      showToast.success(
        'Invitation cancelled',
        `${invitation.email} can no longer use that invite.`,
      );
      refresh();
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.invitations(invitation.projectId),
      });
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Could not cancel the invitation' });
    } finally {
      setCancellingId(null);
    }
  }

  const unlimited = seats ? isUnlimitedQuota(seats.max) : false;
  const full = !!seats && !unlimited && seats.used >= seats.max;

  return (
    <SettingsPage
      title='Members'
      description={`Everyone with a seat in ${workspace.name}. Invite people from a project.`}
    >
      <SettingsSection title='Seats' icon={UsersIcon}>
        <SettingsRow
          label={
            !seats ? 'Loading...'
            : unlimited ?
              `${seats.used} ${seats.used === 1 ? 'person' : 'people'}, including you`
            : `${seats.used} of ${seats.max} people, including you`
          }
          description={
            unlimited ?
              'Your plan has no limit on people.'
            : 'Everyone in the workspace holds a seat, and so does each person with a pending invitation. Removing someone from a project does not free their seat; removing them here does.'
          }
        >
          {full && (
            <Button size='sm' asChild>
              <Link to={workspaceSettingsPath(workspace.slug, 'plans') as string}>Upgrade</Link>
            </Button>
          )}
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title='People'>
        {members.map(member => {
          const name = member.name || member.email;
          const isSelf = member.userId === user?.id;
          const isOwner = member.role === 'owner';
          return (
            <SettingsRow
              key={member.userId}
              media={
                <Avatar className='size-8'>
                  <AvatarImage src={avatarSrc(member.image)} alt='' />
                  <AvatarFallback className='text-xs'>{getInitials(name)}</AvatarFallback>
                </Avatar>
              }
              label={
                <span className='flex items-center gap-2'>
                  {name}
                  {isSelf && <span className='text-muted-foreground font-normal'>(you)</span>}
                  <Badge variant='outline'>{isOwner ? 'Owner' : 'Member'}</Badge>
                </span>
              }
              description={member.email}
              meta={isOwner ? undefined : projectList(member.projects)}
            >
              {!isOwner && (
                <Button variant='outline' size='sm' onClick={() => setPendingRemove(member)}>
                  Remove
                </Button>
              )}
            </SettingsRow>
          );
        })}
      </SettingsSection>

      {pendingInvitations.length > 0 && (
        <SettingsSection title='Pending invitations' icon={MailIcon}>
          {pendingInvitations.map(invitation => (
            <SettingsRow
              key={invitation.id}
              label={invitation.email}
              description={`Invited to ${invitation.projectName} on ${formatDate(invitation.createdAt)}`}
              meta={`Expires ${formatDate(invitation.expiresAt)}`}
            >
              <Button
                variant='outline'
                size='sm'
                disabled={cancellingId === invitation.id}
                onClick={() => handleCancel(invitation)}
              >
                {cancellingId === invitation.id ? 'Cancelling...' : 'Cancel'}
              </Button>
            </SettingsRow>
          ))}
        </SettingsSection>
      )}

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
                Remove {pendingRemove?.name || pendingRemove?.email} from {workspace.name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingRemove && pendingRemove.projects.length > 0 ?
                  `They lose access to ${pendingRemove.projects.map(p => `"${p.name}"`).join(', ')} straight away, and their seat is freed. Their completed checklists stay with the projects, and any study still assigned to them will need a new reviewer.`
                : 'Their seat is freed straight away.'}{' '}
                Adding them back takes a new invitation.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={confirmRemove}>
              Remove from workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsPage>
  );
}
