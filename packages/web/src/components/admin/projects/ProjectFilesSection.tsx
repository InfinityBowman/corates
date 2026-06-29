import { Link } from '@tanstack/react-router';
import { FileTextIcon } from 'lucide-react';
import { AdminBox } from '@/components/admin/ui';
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
import type { ProjectFile } from './types';

export function ProjectFilesSection({ files }: { files?: ProjectFile[] }) {
  return (
    <AdminBox className='mb-6'>
      <h2 className='text-foreground mb-4 flex items-center text-lg font-semibold'>
        <FileTextIcon className='mr-2 size-5' />
        Files ({files?.length ?? 0})
      </h2>
      {(files?.length ?? 0) > 0 ?
        <Table>
          <TableHeader>
            <TableRow className='border-border bg-muted border-b'>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                File
              </TableHead>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                Type
              </TableHead>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                Size
              </TableHead>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                Uploaded By
              </TableHead>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                Uploaded
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files!.map(file => (
              <TableRow key={file.id}>
                <TableCell className='text-foreground px-4 py-3 text-sm'>
                  <div className='flex items-center gap-2'>
                    <FileTextIcon className='text-muted-foreground/70 size-4' />
                    <span className='text-foreground font-medium'>
                      {file.originalName || file.filename}
                    </span>
                  </div>
                </TableCell>
                <TableCell className='text-muted-foreground px-4 py-3 text-sm'>
                  {file.fileType || '-'}
                </TableCell>
                <TableCell className='text-muted-foreground px-4 py-3 text-sm'>
                  {formatFileSize(file.fileSize ?? 0)}
                </TableCell>
                <TableCell className='text-foreground px-4 py-3 text-sm'>
                  {file.uploadedBy ?
                    <Link
                      to={'/admin/users/$userId' as string}
                      params={{ userId: file.uploadedBy } as Record<string, string>}
                      className='text-blue-600 hover:text-blue-700'
                    >
                      {file.uploaderDisplayName || file.uploaderName}
                    </Link>
                  : <span className='text-muted-foreground/70'>-</span>}
                </TableCell>
                <TableCell className='text-muted-foreground px-4 py-3 text-sm'>
                  {formatDate(file.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      : <p className='text-muted-foreground text-sm'>No files uploaded</p>}
    </AdminBox>
  );
}
