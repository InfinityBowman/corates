import { FolderIcon } from 'lucide-react';
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
import type { UserProject } from './types';

export function UserProjects({ projects }: { projects?: UserProject[] }) {
  return (
    <AdminBox className='mb-6'>
      <h2 className='text-foreground mb-4 flex items-center text-lg font-semibold'>
        <FolderIcon className='mr-2 size-5' />
        Projects ({projects?.length ?? 0})
      </h2>
      {(projects?.length ?? 0) > 0 ?
        <Table>
          <TableHeader>
            <TableRow className='border-border bg-muted border-b'>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                Project
              </TableHead>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                Role
              </TableHead>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                Joined
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects!.map(project => (
              <TableRow key={project.id}>
                <TableCell className='text-foreground px-4 py-3 text-sm font-medium'>
                  {project.name}
                </TableCell>
                <TableCell className='text-foreground px-4 py-3 text-sm'>
                  <Badge variant={project.role === 'owner' ? 'default' : 'secondary'}>
                    {project.role}
                  </Badge>
                </TableCell>
                <TableCell className='text-muted-foreground px-4 py-3 text-sm'>
                  {formatDate(project.joinedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      : <p className='text-muted-foreground text-sm'>Not a member of any projects</p>}
    </AdminBox>
  );
}
