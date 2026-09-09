import { Link } from '@tanstack/react-router';
import { AdminEmpty, AdminPanel, ADMIN_TH, ADMIN_TD, ADMIN_TD_MUTED } from '@/components/admin/ui';
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

function invitationStatus(invitation: ProjectInvitation): 'accepted' | 'pending' | 'expired' {
  if (invitation.acceptedAt) return 'accepted';
  if (!invitation.expiresAt) return 'pending';
  return new Date(invitation.expiresAt * 1000) > new Date() ? 'pending' : 'expired';
}

const STATUS_BADGE = {
  accepted: { variant: 'success', label: 'Accepted' },
  pending: { variant: 'warning', label: 'Pending' },
  expired: { variant: 'destructive', label: 'Expired' },
} as const;

export function ProjectInvitationsSection({ invitations }: { invitations?: ProjectInvitation[] }) {
  const rows = invitations ?? [];

  return (
    <AdminPanel title={`Invitations (${rows.length})`}>
      {rows.length === 0 ?
        <AdminEmpty title='No invitations' />
      : <Table>
          <TableHeader className='bg-muted/40'>
            <TableRow className='border-border hover:bg-transparent'>
              <TableHead className={ADMIN_TH}>Email</TableHead>
              <TableHead className={ADMIN_TH}>Role</TableHead>
              <TableHead className={ADMIN_TH}>Status</TableHead>
              <TableHead className={ADMIN_TH}>Invited by</TableHead>
              <TableHead className={ADMIN_TH}>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(invitation => {
              const badge = STATUS_BADGE[invitationStatus(invitation)];
              return (
                <TableRow key={invitation.id} className='border-border'>
                  <TableCell className={ADMIN_TD}>{invitation.email}</TableCell>
                  <TableCell className={ADMIN_TD}>
                    <Badge variant='secondary'>{invitation.role}</Badge>
                    {invitation.grantOrgMembership && (
                      <span className='text-muted-foreground ml-1.5 text-xs'>+ org</span>
                    )}
                  </TableCell>
                  <TableCell className={ADMIN_TD}>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </TableCell>
                  <TableCell className={ADMIN_TD}>
                    <Link
                      to={'/admin/users/$userId' as string}
                      params={{ userId: invitation.invitedBy } as Record<string, string>}
                      className='text-primary hover:text-primary/80'
                    >
                      {invitation.inviterDisplayName || invitation.inviterName}
                    </Link>
                  </TableCell>
                  <TableCell className={`${ADMIN_TD_MUTED} tabular-nums`}>
                    {formatDate(invitation.createdAt)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      }
    </AdminPanel>
  );
}
