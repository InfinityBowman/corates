import { Link } from '@tanstack/react-router';
import { UserMinusIcon } from 'lucide-react';
import { AdminEmpty, AdminPanel, ADMIN_TH, ADMIN_TD, ADMIN_TD_MUTED } from '@/components/admin/ui';
import { UserAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { formatDate } from '@/lib/formatDate';
import type { ProjectMember } from './types';

interface ProjectMembersSectionProps {
  members?: ProjectMember[];
  loading: boolean;
  onRemove: (member: ProjectMember) => void;
}

export function ProjectMembersSection({ members, loading, onRemove }: ProjectMembersSectionProps) {
  const rows = members ?? [];

  return (
    <AdminPanel title={`Members (${rows.length})`}>
      {rows.length === 0 ?
        <AdminEmpty title='No members' />
      : <Table>
          <TableHeader className='bg-muted/40'>
            <TableRow className='border-border hover:bg-transparent'>
              <TableHead className={ADMIN_TH}>User</TableHead>
              <TableHead className={ADMIN_TH}>Role</TableHead>
              <TableHead className={ADMIN_TH}>Joined</TableHead>
              <TableHead className={`${ADMIN_TH} text-right`}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(member => (
              <TableRow key={member.id} className='border-border'>
                <TableCell className={ADMIN_TD}>
                  <div className='flex items-center gap-2.5'>
                    <UserAvatar
                      src={member.userAvatar}
                      name={member.userDisplayName || member.userName}
                      className='size-6.5'
                    />
                    <div className='min-w-0'>
                      <Link
                        to={'/admin/users/$userId' as string}
                        params={{ userId: member.userId } as Record<string, string>}
                        className='text-foreground hover:text-primary font-medium transition-colors'
                      >
                        {member.userDisplayName || member.userName}
                      </Link>
                      <p className='text-muted-foreground truncate text-xs'>{member.userEmail}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className={ADMIN_TD}>
                  <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                    {member.role}
                  </Badge>
                </TableCell>
                <TableCell className={`${ADMIN_TD_MUTED} tabular-nums`}>
                  {formatDate(member.joinedAt)}
                </TableCell>
                <TableCell className={`${ADMIN_TD} text-right`}>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    className='text-muted-foreground/70 hover:text-destructive'
                    onClick={() => onRemove(member)}
                    disabled={loading}
                    aria-label={`Remove ${member.userDisplayName || member.userName}`}
                  >
                    <UserMinusIcon />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    </AdminPanel>
  );
}
