/**
 * InvitationCard - a pending invitation rendered as a ghost project card in
 * the projects grid. Accept turns it into a real project card in place;
 * Decline deletes the invitation immediately.
 */

import { useState } from 'react';
import { MailIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { acceptInvitation, declineInvitation } from '@/server/functions/invitations.functions';
import type { PendingInvitation } from '@/server/functions/invitations.server';
import { getDomainError, handleError } from '@/lib/error-utils';
import { showToast } from '@/lib/toast';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

interface InvitationCardProps {
  invitation: PendingInvitation;
  style?: React.CSSProperties;
}

export function InvitationCard({ invitation, style }: InvitationCardProps) {
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
    <Card
      data-testid='invitation-card'
      className='border-primary/30 bg-muted/30 rounded-2xl border-2 border-dashed p-6 shadow-none'
      style={style}
    >
      <CardContent className='flex flex-1 flex-col p-0'>
        <div className='mb-4'>
          <div className='mb-2 flex items-center gap-2'>
            <Badge variant='secondary' className='text-2xs tracking-wide uppercase'>
              Invitation
            </Badge>
            <MailIcon className='text-muted-foreground size-3.5' />
          </div>
          <h3 className='text-foreground line-clamp-2 text-lg leading-snug font-semibold'>
            {invitation.projectName}
          </h3>
        </div>

        <p className='text-muted-foreground mb-5 text-sm leading-relaxed'>
          {invitation.inviterName} invited you to join as{' '}
          {invitation.role === 'owner' ? 'an owner' : 'a member'}.
        </p>

        <div className='mt-auto flex items-center justify-end gap-2'>
          <Button
            variant='ghost'
            className='text-muted-foreground'
            onClick={handleDecline}
            disabled={busy !== null}
          >
            {busy === 'decline' ? 'Declining...' : 'Decline'}
          </Button>
          <Button onClick={handleAccept} disabled={busy !== null}>
            {busy === 'accept' ? 'Accepting...' : 'Accept'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
