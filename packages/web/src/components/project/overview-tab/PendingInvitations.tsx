/**
 * PendingInvitations - Outstanding project invitations shown to members on
 * the Overview tab. Owners can cancel; re-inviting the same email from the
 * invite modal resends with a fresh expiry.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MailIcon, XIcon } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { Badge } from '@/components/ui/badge';
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
      showToast.success('Invitation Cancelled', `Cancelled invitation to ${invitation.email}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.invitations(projectId) });
    } catch (err: unknown) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className='mt-4'>
      <h4 className='text-muted-foreground mb-2 text-sm font-medium'>
        Pending Invitations ({invitations.length})
      </h4>
      <div className='flex flex-col gap-2'>
        {invitations.map(invitation => {
          const expiry = expiryText(invitation.expiresAt);
          return (
            <div
              key={invitation.id}
              className='border-border flex items-center justify-between rounded-lg border border-dashed p-3'
            >
              <div className='flex items-center gap-3'>
                <div className='bg-muted flex size-9 items-center justify-center rounded-full'>
                  <MailIcon className='text-muted-foreground size-4' />
                </div>
                <div>
                  <p className='text-foreground font-medium'>{invitation.email}</p>
                  <p
                    className={
                      expiry.expired ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'
                    }
                  >
                    {expiry.text}
                  </p>
                </div>
              </div>
              <div className='flex items-center gap-2'>
                <Badge variant='outline' className='capitalize'>
                  {invitation.role}
                </Badge>
                {isOwner && (
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    onClick={() => handleCancel(invitation)}
                    disabled={cancellingId === invitation.id}
                    className='text-muted-foreground hover:text-red-600'
                    title='Cancel invitation'
                    aria-label='Cancel invitation'
                  >
                    <XIcon className='size-4' />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
