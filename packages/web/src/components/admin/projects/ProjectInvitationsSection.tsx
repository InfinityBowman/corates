import { Link } from '@tanstack/react-router';
import { MailIcon, CheckCircleIcon, ClockIcon } from 'lucide-react';
import { AdminBox } from '@/components/admin/ui';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { formatDate } from '@/lib/formatDate';
import type { ProjectInvitation } from './types';

const isInvitationPending = (invitation: ProjectInvitation): boolean => {
  if (invitation.acceptedAt) return false;
  if (!invitation.expiresAt) return true;
  const expiresAt = new Date(invitation.expiresAt * 1000);
  return expiresAt > new Date();
};

const isInvitationExpired = (invitation: ProjectInvitation): boolean => {
  if (invitation.acceptedAt) return false;
  if (!invitation.expiresAt) return false;
  const expiresAt = new Date(invitation.expiresAt * 1000);
  return expiresAt <= new Date();
};

export function ProjectInvitationsSection({ invitations }: { invitations?: ProjectInvitation[] }) {
  return (
    <AdminBox className='mb-6'>
      <h2 className='text-foreground mb-4 flex items-center text-lg font-semibold'>
        <MailIcon className='mr-2 size-5' />
        Invitations ({invitations?.length ?? 0})
      </h2>
      {(invitations?.length ?? 0) > 0 ?
        <Table>
          <TableHeader>
            <TableRow className='border-border bg-muted border-b'>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                Email
              </TableHead>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                Role
              </TableHead>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                Status
              </TableHead>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                Invited By
              </TableHead>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                Created
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations!.map(invitation => (
              <TableRow key={invitation.id}>
                <TableCell className='text-foreground px-4 py-3 text-sm'>
                  {invitation.email}
                </TableCell>
                <TableCell className='text-foreground px-4 py-3 text-sm'>
                  <Badge variant='secondary'>{invitation.role}</Badge>
                  {invitation.grantOrgMembership && (
                    <span className='text-muted-foreground ml-1 text-xs'>+ org</span>
                  )}
                </TableCell>
                <TableCell className='text-foreground px-4 py-3 text-sm'>
                  {invitation.acceptedAt && (
                    <Badge variant='success'>
                      <CheckCircleIcon className='mr-1 size-3' />
                      Accepted
                    </Badge>
                  )}
                  {isInvitationPending(invitation) && (
                    <Badge variant='warning'>
                      <ClockIcon className='mr-1 size-3' />
                      Pending
                    </Badge>
                  )}
                  {isInvitationExpired(invitation) && <Badge variant='destructive'>Expired</Badge>}
                </TableCell>
                <TableCell className='text-foreground px-4 py-3 text-sm'>
                  <Link
                    to={'/admin/users/$userId' as string}
                    params={{ userId: invitation.invitedBy } as Record<string, string>}
                    className='text-primary hover:text-primary/80'
                  >
                    {invitation.inviterDisplayName || invitation.inviterName}
                  </Link>
                </TableCell>
                <TableCell className='text-muted-foreground px-4 py-3 text-sm'>
                  {formatDate(invitation.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      : <p className='text-muted-foreground text-sm'>No invitations</p>}
    </AdminBox>
  );
}
