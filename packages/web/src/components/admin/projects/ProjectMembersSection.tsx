import { Link } from '@tanstack/react-router';
import { UsersIcon, UserMinusIcon } from 'lucide-react';
import { AdminBox } from '@/components/admin/ui';
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
  return (
    <AdminBox className='mb-6'>
      <h2 className='text-foreground mb-4 flex items-center text-lg font-semibold'>
        <UsersIcon className='mr-2 size-5' />
        Members ({members?.length ?? 0})
      </h2>
      {(members?.length ?? 0) > 0 ?
        <Table>
          <TableHeader>
            <TableRow className='border-border bg-muted border-b'>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                User
              </TableHead>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                Role
              </TableHead>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                Joined
              </TableHead>
              <TableHead className='text-muted-foreground px-6 py-3 text-right text-xs font-medium tracking-wider uppercase'>
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members!.map(member => (
              <TableRow key={member.id}>
                <TableCell className='text-foreground px-4 py-3 text-sm'>
                  <div className='flex items-center gap-3'>
                    <UserAvatar
                      src={member.userAvatar}
                      name={member.userDisplayName || member.userName}
                      size='sm'
                    />
                    <div>
                      <Link
                        to={'/admin/users/$userId' as string}
                        params={{ userId: member.userId } as Record<string, string>}
                        className='font-medium text-blue-600 hover:text-blue-700'
                      >
                        {member.userDisplayName || member.userName}
                      </Link>
                      <p className='text-muted-foreground text-xs'>{member.userEmail}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className='text-foreground px-4 py-3 text-sm'>
                  <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                    {member.role}
                  </Badge>
                </TableCell>
                <TableCell className='text-muted-foreground px-4 py-3 text-sm'>
                  {formatDate(member.joinedAt)}
                </TableCell>
                <TableCell className='text-foreground px-4 py-3 text-right text-sm'>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    className='text-destructive hover:text-destructive'
                    onClick={() => onRemove(member)}
                    disabled={loading}
                    title='Remove member'
                  >
                    <UserMinusIcon />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      : <p className='text-muted-foreground text-sm'>No members</p>}
    </AdminBox>
  );
}
