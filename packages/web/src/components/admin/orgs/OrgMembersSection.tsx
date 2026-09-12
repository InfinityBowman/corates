import { Link } from '@tanstack/react-router';
import { AdminEmpty, AdminPanel, ADMIN_TH, ADMIN_TD, ADMIN_TD_MUTED } from '@/components/admin/ui';
import { UserAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { formatDate } from '@/lib/formatDate';
import type { AdminOrgMember } from '@/server/functions/admin-orgs.server';

interface OrgMembersSectionProps {
  members?: AdminOrgMember[];
  total: number;
  isLoading?: boolean;
}

export function OrgMembersSection({ members, total, isLoading }: OrgMembersSectionProps) {
  const rows = members ?? [];

  return (
    <AdminPanel
      title={`Members (${total})`}
      footer={
        rows.length < total ?
          <span className='text-muted-foreground text-[13px]'>
            Showing the {rows.length} most recently joined.
          </span>
        : undefined
      }
    >
      {isLoading ?
        <div className='p-4'>
          <Skeleton className='h-40 w-full' />
        </div>
      : rows.length === 0 ?
        <AdminEmpty title='No members' />
      : <Table>
          <TableHeader className='bg-muted/40'>
            <TableRow className='border-border hover:bg-transparent'>
              <TableHead className={ADMIN_TH}>User</TableHead>
              <TableHead className={`${ADMIN_TH} w-28`}>Role</TableHead>
              <TableHead className={`${ADMIN_TH} w-32`}>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(member => (
              <TableRow key={member.id} className='border-border'>
                <TableCell className={ADMIN_TD}>
                  <div className='flex items-center gap-2.5'>
                    <UserAvatar
                      src={member.userAvatar ?? undefined}
                      name={member.userName ?? undefined}
                      className='size-6.5'
                    />
                    <div className='min-w-0'>
                      <div className='flex items-center gap-2'>
                        <Link
                          to={'/admin/users/$userId' as string}
                          params={{ userId: member.userId } as Record<string, string>}
                          className='text-foreground hover:text-primary font-medium transition-colors'
                        >
                          {member.userName || member.userEmail}
                        </Link>
                        {member.userBanned && <Badge variant='destructive'>Banned</Badge>}
                      </div>
                      <p className='text-muted-foreground truncate text-xs'>{member.userEmail}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className={ADMIN_TD}>
                  <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                    {member.role ?? 'member'}
                  </Badge>
                </TableCell>
                <TableCell className={`${ADMIN_TD_MUTED} tabular-nums`}>
                  {formatDate(member.joinedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    </AdminPanel>
  );
}
