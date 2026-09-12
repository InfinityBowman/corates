/**
 * InvitationRow - a pending invitation with Accept and Decline. Accept turns
 * it into a project row in place; Decline deletes the invitation immediately.
 */

import { useState } from 'react';
import { MailIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { acceptInvitation, declineInvitation } from '@/server/functions/invitations.functions';
import type { PendingInvitation } from '@/server/functions/invitations.server';
import { getDomainError, handleError } from '@/lib/error-utils';
import { showToast } from '@/lib/toast';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { rowClass } from './DashboardSection';

interface InvitationRowProps {
  invitation: PendingInvitation;
}

export function InvitationRow({ invitation }: InvitationRowProps) {
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: queryKeys.invitations.pendingForMe });
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
  }

  async function handleAccept() {
    setBusy('accept');
    try {
      const result = await acceptInvitation({ data: { token: invitation.token } });
      showToast.success('Invitation accepted', `You now have access to "${result.projectName}"`);
      refresh();
    } catch (err) {
      if (getDomainError(err)?.code === 'PROJECT_MEMBER_ALREADY_EXISTS') {
        showToast.success('Already a member', 'You already have access to this project.');
        refresh();
      } else {
        await handleError(err, { toastTitle: 'Could not accept invitation' });
        setBusy(null);
      }
    }
  }

  async function handleDecline() {
    setBusy('decline');
    try {
      await declineInvitation({ data: { invitationId: invitation.id } });
      showToast.success('Invitation declined');
      refresh();
    } catch (err) {
      await handleError(err, { toastTitle: 'Could not decline invitation' });
      setBusy(null);
    }
  }

  return (
    <div data-testid='invitation-card' className={rowClass(false)}>
      <MailIcon className='text-muted-foreground size-4 shrink-0' aria-hidden='true' />
      <span className='min-w-0 flex-1 truncate'>
        <span className='text-foreground font-medium'>{invitation.inviterName} invited you</span>
        <span className='text-muted-foreground'>
          {' '}
          to {invitation.projectName} as {invitation.role === 'owner' ? 'Lead' : 'Reviewer'}
        </span>
      </span>
      <Button
        variant='ghost'
        size='sm'
        className='text-muted-foreground'
        onClick={handleDecline}
        disabled={busy !== null}
      >
        {busy === 'decline' ? 'Declining...' : 'Decline'}
      </Button>
      <Button size='sm' onClick={handleAccept} disabled={busy !== null}>
        {busy === 'accept' ? 'Accepting...' : 'Accept'}
      </Button>
    </div>
  );
}
