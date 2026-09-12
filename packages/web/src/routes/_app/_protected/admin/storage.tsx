import { useState, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Trash2Icon, ChevronLeftIcon, ChevronRightIcon, FileIcon } from 'lucide-react';
import { useStorageDocuments } from '@/hooks/useAdminQueries';
import { deleteStorageDocuments } from '@/stores/adminStore';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { showToast } from '@/lib/toast';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  AdminEmpty,
  AdminPage,
  AdminPanel,
  AdminSearch,
  ADMIN_TH,
  ADMIN_TD,
  ADMIN_TD_MUTED,
} from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/formatDate';
import { formatFileSize } from '@corates/shared';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

export const Route = createFileRoute('/_app/_protected/admin/storage')({
  component: StorageManagementPage,
});

const PAGE_SIZE = 50;

function StorageManagementPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [prefix, setPrefix] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [deleteKeys, setDeleteKeys] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const documentsDataQuery = useStorageDocuments({
    cursor,
    limit: PAGE_SIZE,
    prefix,
    search: debouncedSearch,
  });
  const documentsData = documentsDataQuery.data;
  const documents = documentsData?.documents ?? [];

  const resetPaging = () => {
    setCursor(null);
    setCursorHistory([]);
    setSelectedKeys(new Set());
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    resetPaging();
  };

  const handlePrefixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPrefix(e.target.value);
    resetPaging();
  };

  const handleNextPage = () => {
    if (documentsData?.nextCursor) {
      setCursorHistory(prev => [...prev, cursor]);
      setCursor(documentsData.nextCursor ?? null);
    }
  };

  const handlePrevPage = () => {
    setCursorHistory(prev => {
      setCursor(prev.length > 0 ? (prev[prev.length - 1] ?? null) : null);
      return prev.slice(0, -1);
    });
  };

  const toggleSelect = useCallback((key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const allCurrentPageSelected =
    documents.length > 0 && documents.every(doc => selectedKeys.has(doc.key));

  const toggleSelectAll = () => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      for (const doc of documents) {
        if (allCurrentPageSelected) next.delete(doc.key);
        else next.add(doc.key);
      }
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deleteKeys || deleteKeys.length === 0) return;

    setDeleting(true);
    try {
      const result = (await deleteStorageDocuments(deleteKeys)) as {
        deleted: number;
        failed: number;
      };
      setDeleteKeys(null);
      setSelectedKeys(new Set());

      if (result.failed > 0) {
        showToast.warning(
          'Partial delete success',
          `Deleted ${result.deleted} documents. ${result.failed} failed.`,
        );
      } else {
        showToast.success('Documents deleted', `Successfully deleted ${result.deleted} documents.`);
      }

      documentsDataQuery.refetch();
    } catch (error) {
      showToast.error('Delete failed', (error as Error).message || 'Failed to delete documents');
    } finally {
      setDeleting(false);
    }
  };

  const handleRowClick = (e: React.MouseEvent, key: string) => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;
    if ((e.target as HTMLElement).closest('button, input, [role="checkbox"]')) return;
    toggleSelect(key);
  };

  return (
    <AdminPage
      title='Storage'
      description='PDFs in R2. Files marked orphaned exist in R2 but are not tracked in the mediaFiles table, usually from a failed cleanup, and are safe to delete.'
    >
      <div className='flex flex-col gap-3 sm:flex-row'>
        <AdminSearch
          value={search}
          onChange={handleSearchChange}
          placeholder='Search by file name...'
          className='flex-1'
        />
        <Input
          type='text'
          placeholder='Filter by prefix (e.g. projects/{id}/)'
          value={prefix}
          onChange={handlePrefixChange}
          className='text-[13px] sm:w-72'
        />
      </div>

      <AdminPanel
        title='Documents'
        action={
          // Rendered as a fixed-height slot so selecting rows does not shift the table.
          <div className='flex h-8 items-center gap-2'>
            {selectedKeys.size > 0 && (
              <>
                <span className='text-muted-foreground text-[13px] tabular-nums'>
                  {selectedKeys.size} selected
                </span>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => setSelectedKeys(new Set())}
                >
                  Clear
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='text-destructive hover:text-destructive'
                  onClick={() => setDeleteKeys(Array.from(selectedKeys))}
                >
                  Delete selected
                </Button>
              </>
            )}
          </div>
        }
        footer={
          <>
            <p className='text-muted-foreground text-[13px] tabular-nums'>
              {documents.length} document{documents.length === 1 ? '' : 's'}
              {documentsData?.truncated && ' - truncated after 10,000 objects'}
            </p>
            <div className='flex items-center gap-1'>
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                onClick={handlePrevPage}
                disabled={cursorHistory.length === 0}
                aria-label='Previous page'
              >
                <ChevronLeftIcon className='size-4' />
              </Button>
              <span className='text-muted-foreground px-1 text-[13px] tabular-nums'>
                Page {cursorHistory.length + 1}
              </span>
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                onClick={handleNextPage}
                disabled={!documentsData?.nextCursor}
                aria-label='Next page'
              >
                <ChevronRightIcon className='size-4' />
              </Button>
            </div>
          </>
        }
      >
        <Table>
          <TableHeader className='bg-muted/40'>
            <TableRow className='border-border hover:bg-transparent'>
              <TableHead className={`${ADMIN_TH} w-10`}>
                <Checkbox
                  checked={allCurrentPageSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label='Select all on this page'
                />
              </TableHead>
              <TableHead className={ADMIN_TH}>File name</TableHead>
              <TableHead className={ADMIN_TH}>Size</TableHead>
              <TableHead className={ADMIN_TH}>Project</TableHead>
              <TableHead className={ADMIN_TH}>Study</TableHead>
              <TableHead className={ADMIN_TH}>Uploaded</TableHead>
              <TableHead className={`${ADMIN_TH} w-12`} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {documentsDataQuery.isLoading ?
              Array.from({ length: 10 }, (_, i) => (
                <TableRow key={`skeleton-${i}`} className='border-border hover:bg-transparent'>
                  {Array.from({ length: 7 }, (__, j) => (
                    <TableCell key={j} className='h-11 px-3'>
                      <Skeleton className='h-3.5 w-3/4' />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : documents.length === 0 ?
              <TableRow className='hover:bg-transparent'>
                <TableCell colSpan={7} className='p-0'>
                  <AdminEmpty
                    icon={FileIcon}
                    title='No documents found'
                    description={search || prefix ? 'No object matches the filters.' : undefined}
                  />
                </TableCell>
              </TableRow>
            : documents.map(doc => (
                <TableRow
                  key={doc.key}
                  className='border-border cursor-pointer'
                  data-state={selectedKeys.has(doc.key) ? 'selected' : undefined}
                  onClick={e => handleRowClick(e, doc.key)}
                >
                  <TableCell className={ADMIN_TD}>
                    <Checkbox
                      checked={selectedKeys.has(doc.key)}
                      onCheckedChange={() => toggleSelect(doc.key)}
                      aria-label={`Select ${doc.fileName}`}
                    />
                  </TableCell>
                  <TableCell className={ADMIN_TD}>
                    <div className='flex items-center gap-2'>
                      <span className='font-mono'>{doc.fileName}</span>
                      {doc.orphaned && <Badge variant='warning'>Orphaned</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className={`${ADMIN_TD_MUTED} tabular-nums`}>
                    {formatFileSize(doc.size ?? 0)}
                  </TableCell>
                  <TableCell className={`${ADMIN_TD_MUTED} font-mono text-xs`}>
                    {doc.projectId || '-'}
                  </TableCell>
                  <TableCell className={`${ADMIN_TD_MUTED} font-mono text-xs`}>
                    {doc.studyId || '-'}
                  </TableCell>
                  <TableCell className={`${ADMIN_TD_MUTED} tabular-nums`}>
                    {formatDateTime(doc.uploaded)}
                  </TableCell>
                  <TableCell className={`${ADMIN_TD} text-right`}>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon-sm'
                      onClick={e => {
                        e.stopPropagation();
                        setDeleteKeys([doc.key]);
                      }}
                      className='text-muted-foreground/70 hover:text-destructive'
                      aria-label={`Delete ${doc.fileName}`}
                    >
                      <Trash2Icon className='size-4' />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </AdminPanel>

      <AlertDialog open={!!deleteKeys} onOpenChange={open => !open && setDeleteKeys(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete documents</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete {deleteKeys?.length ?? 0} document
              {deleteKeys?.length === 1 ? '' : 's'} from R2. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
}
