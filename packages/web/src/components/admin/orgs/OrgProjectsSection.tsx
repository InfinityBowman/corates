import { Link } from '@tanstack/react-router';
import { AdminEmpty, AdminPanel, ADMIN_TH, ADMIN_TD, ADMIN_TD_MUTED } from '@/components/admin/ui';
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
import type { AdminOrgProject } from '@/server/functions/admin-orgs.server';

interface OrgProjectsSectionProps {
  projects?: AdminOrgProject[];
  total: number;
  isLoading?: boolean;
}

export function OrgProjectsSection({ projects, total, isLoading }: OrgProjectsSectionProps) {
  const rows = projects ?? [];

  return (
    <AdminPanel
      title={`Projects (${total})`}
      footer={
        rows.length < total ?
          <span className='text-muted-foreground text-[13px]'>
            Showing the {rows.length} most recently created.
          </span>
        : undefined
      }
    >
      {isLoading ?
        <div className='p-4'>
          <Skeleton className='h-40 w-full' />
        </div>
      : rows.length === 0 ?
        <AdminEmpty title='No projects' />
      : <Table>
          <TableHeader className='bg-muted/40'>
            <TableRow className='border-border hover:bg-transparent'>
              <TableHead className={ADMIN_TH}>Project</TableHead>
              <TableHead className={ADMIN_TH}>Created by</TableHead>
              <TableHead className={`${ADMIN_TH} w-32`}>Created</TableHead>
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
                  {project.creatorName || project.creatorEmail ?
                    <Link
                      to={'/admin/users/$userId' as string}
                      params={{ userId: project.createdBy } as Record<string, string>}
                      className='text-muted-foreground hover:text-primary transition-colors'
                    >
                      {project.creatorName || project.creatorEmail}
                    </Link>
                  : <span className='text-muted-foreground/60'>-</span>}
                </TableCell>
                <TableCell className={`${ADMIN_TD_MUTED} tabular-nums`}>
                  {formatDate(project.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    </AdminPanel>
  );
}
