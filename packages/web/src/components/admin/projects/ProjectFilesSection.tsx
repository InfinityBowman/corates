import { Link } from '@tanstack/react-router';
import { AdminEmpty, AdminPanel, ADMIN_TH, ADMIN_TD, ADMIN_TD_MUTED } from '@/components/admin/ui';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { formatFileSize } from '@corates/shared';
import { formatDate } from '@/lib/formatDate';
import type { AdminProjectFile } from '@/server/functions/admin-projects.server';

export function ProjectFilesSection({ files }: { files?: AdminProjectFile[] }) {
  const rows = files ?? [];

  return (
    <AdminPanel title={`Files (${rows.length})`}>
      {rows.length === 0 ?
        <AdminEmpty title='No files uploaded' />
      : <Table>
          <TableHeader className='bg-muted/40'>
            <TableRow className='border-border hover:bg-transparent'>
              <TableHead className={ADMIN_TH}>File</TableHead>
              <TableHead className={ADMIN_TH}>Type</TableHead>
              <TableHead className={ADMIN_TH}>Size</TableHead>
              <TableHead className={ADMIN_TH}>Uploaded by</TableHead>
              <TableHead className={ADMIN_TH}>Uploaded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(file => (
              <TableRow key={file.id} className='border-border'>
                <TableCell className={`${ADMIN_TD} font-medium`}>
                  {file.originalName || file.filename}
                </TableCell>
                <TableCell className={ADMIN_TD_MUTED}>{file.fileType || '-'}</TableCell>
                <TableCell className={`${ADMIN_TD_MUTED} tabular-nums`}>
                  {formatFileSize(file.fileSize ?? 0)}
                </TableCell>
                <TableCell className={ADMIN_TD}>
                  {file.uploadedBy ?
                    <Link
                      to={'/admin/users/$userId' as string}
                      params={{ userId: file.uploadedBy } as Record<string, string>}
                      className='text-primary hover:text-primary/80'
                    >
                      {file.uploaderName}
                    </Link>
                  : <span className='text-muted-foreground/60'>-</span>}
                </TableCell>
                <TableCell className={`${ADMIN_TD_MUTED} tabular-nums`}>
                  {formatDate(file.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    </AdminPanel>
  );
}
