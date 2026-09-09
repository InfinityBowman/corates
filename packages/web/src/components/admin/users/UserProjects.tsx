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
import type { UserProject } from './types';

export function UserProjects({ projects }: { projects?: UserProject[] }) {
  const rows = projects ?? [];

  return (
    <AdminPanel title={`Projects (${rows.length})`}>
      {rows.length === 0 ?
        <AdminEmpty title='No projects' description='This user is not a member of any project.' />
      : <Table>
          <TableHeader className='bg-muted/40'>
            <TableRow className='border-border hover:bg-transparent'>
              <TableHead className={ADMIN_TH}>Project</TableHead>
              <TableHead className={ADMIN_TH}>Role</TableHead>
              <TableHead className={ADMIN_TH}>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(project => (
              <TableRow key={project.id} className='border-border'>
                <TableCell className={ADMIN_TD}>
                  <Link
                    to={'/admin/projects/$projectId' as string}
                    params={{ projectId: project.id } as Record<string, string>}
                    className='text-foreground hover:text-primary font-medium transition-colors'
                  >
                    {project.name}
                  </Link>
                </TableCell>
                <TableCell className={ADMIN_TD}>
                  <Badge variant={project.role === 'owner' ? 'default' : 'secondary'}>
                    {project.role}
                  </Badge>
                </TableCell>
                <TableCell className={`${ADMIN_TD_MUTED} tabular-nums`}>
                  {formatDate(project.joinedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    </AdminPanel>
  );
}
