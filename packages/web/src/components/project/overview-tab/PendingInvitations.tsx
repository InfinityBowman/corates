/**
 * PendingInvitations - Outstanding project invitations shown to members on
 * the Overview tab. Owners can cancel; re-inviting the same email from the
 * invite modal resends with a fresh expiry.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MailIcon, XIcon } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { getInvitations, cancelInvitation } from '@/server/functions/org-projects.functions';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string | Date;
  createdAt: string | Date;
}

function expiryText(expiresAt: string | Date): { text: string; expired: boolean } {
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) return { text: 'Expired', expired: true };
  const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  return { text: days === 1 ? 'Expires in 1 day' : `Expires in ${days} days`, expired: false };
}

export function PendingInvitations({
  projectId,
  orgId,
  isOwner,
}: {
  projectId: string;
  orgId: string | null;
  isOwner: boolean;
}) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { data: invitations = [] } = useQuery({
    queryKey: queryKeys.projects.invitations(projectId),
    queryFn: async () =>
      (await getInvitations({
        data: { orgId: orgId!, projectId },
      })) as PendingInvitation[],
    enabled: !!orgId,
  });

  if (invitations.length === 0) return null;

  const handleCancel = async (invitation: PendingInvitation) => {
    if (!orgId) return;
    setCancellingId(invitation.id);
    try {
      await cancelInvitation({
        data: { orgId, projectId, invitationId: invitation.id },
      });
      showToast.success(
        'Invitation cancelled',
        `${invitation.email} can no longer use that invite.`,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.invitations(projectId) });
    } catch (err: unknown) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className='mt-1 flex flex-col gap-1'>
      {invitations.map(invitation => {
        const expiry = expiryText(invitation.expiresAt);
        return (
          <div key={invitation.id} className='flex items-center gap-2 py-1 text-sm'>
            <div className='border-border flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed'>
              <MailIcon className='text-muted-foreground size-3' />
            </div>
            <div className='min-w-0 flex-1'>
              <div className='text-muted-foreground truncate' title={invitation.email}>
                {invitation.email}
              </div>
              <div
                className={`text-xs ${expiry.expired ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {expiry.text}
              </div>
            </div>
            <span className='text-muted-foreground shrink-0 text-xs capitalize'>
              {invitation.role}
            </span>
            {isOwner ?
              <Button
                variant='ghost'
                size='icon-xs'
                onClick={() => handleCancel(invitation)}
                disabled={cancellingId === invitation.id}
                className='text-muted-foreground hover:text-destructive'
                aria-label='Cancel invitation'
              >
                <XIcon className='size-3.5' />
              </Button>
            : <span className='size-6 shrink-0' />}
          </div>
        );
      })}
    </div>
  );
}
