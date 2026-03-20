/**
 * Admin Storage Management route
 * Manages R2 documents with search, prefix filtering, cursor-based pagination,
 * multi-select, and bulk/single delete operations.
 */

import { useState, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Trash2Icon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DatabaseIcon,
  CheckSquareIcon,
  SquareIcon,
  LoaderIcon,
} from 'lucide-react';
import { useStorageDocuments } from '@/hooks/useAdminQueries';
import { deleteStorageDocuments } from '@/stores/adminStore';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { showToast } from '@/components/ui/toast';
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
import { DashboardHeader, AdminSection, AdminBox } from '@/components/admin/ui';
import { input } from '@/components/admin/styles/admin-tokens';
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

interface StorageDocument {
  key: string;
  fileName: string;
  size?: number;
  projectId?: string;
  studyId?: string;
  uploaded?: string;
  orphaned?: boolean;
}

interface StorageDocumentsData {
  documents: StorageDocument[];
  nextCursor?: string | null;
  truncated?: boolean;
}

const formatFileSize = (bytes: number | null | undefined): string => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDate = (timestamp: string | null | undefined): string => {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function StorageManagementPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [prefix, setPrefix] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [deleteKeys, setDeleteKeys] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  const limit = 50;

  const documentsDataQuery = useStorageDocuments({
    cursor,
    limit,
    prefix,
    search: debouncedSearch,
  });
  const documentsData = documentsDataQuery.data as StorageDocumentsData | undefined;

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setCursor(null);
    setCursorHistory([]);
    setSelectedKeys(new Set());
  };

  const handlePrefixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPrefix(e.target.value);
    setCursor(null);
    setCursorHistory([]);
    setSelectedKeys(new Set());
  };

  const handleNextPage = () => {
    if (documentsData?.nextCursor) {
      setCursorHistory(prev => [...prev, cursor]);
      setCursor(documentsData.nextCursor);
    }
  };

  const handlePrevPage = () => {
    if (cursorHistory.length > 0) {
      const prevCursor = cursorHistory[cursorHistory.length - 1];
      setCursorHistory(prev => prev.slice(0, -1));
      setCursor(prevCursor ?? null);
    } else {
      setCursor(null);
    }
  };

  const toggleSelect = useCallback((key: string) => {
    setSelectedKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = () => {
    const docs = documentsData?.documents ?? [];
    const currentKeys = new Set(docs.map(d => d.key));

    const allCurrentPageSelected = docs.length > 0 && docs.every(doc => selectedKeys.has(doc.key));

    if (allCurrentPageSelected) {
      setSelectedKeys(prev => {
        const newSet = new Set(prev);
        currentKeys.forEach(key => newSet.delete(key));
        return newSet;
      });
    } else {
      setSelectedKeys(prev => {
        const newSet = new Set(prev);
        currentKeys.forEach(key => newSet.add(key));
        return newSet;
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteKeys || deleteKeys.length === 0) return;

    setLoading(true);
    try {
      const result = (await deleteStorageDocuments(deleteKeys)) as {
        deleted: number;
        failed: number;
      };
      setDeleteKeys(null);
      setSelectedKeys(new Set());

      if (result.failed > 0) {
        showToast.warning(
          'Partial Delete Success',
          `Deleted ${result.deleted} documents. ${result.failed} failed.`,
        );
      } else {
        showToast.success('Documents Deleted', `Successfully deleted ${result.deleted} documents.`);
      }

      documentsDataQuery.refetch();
    } catch (error) {
      showToast.error('Delete Failed', (error as Error).message || 'Failed to delete documents');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = () => {
    const keys = Array.from(selectedKeys);
    if (keys.length === 0) return;
    setDeleteKeys(keys);
  };

  const handleSingleDelete = (key: string) => {
    setDeleteKeys([key]);
  };

  const handleRowClick = (e: React.MouseEvent, key: string) => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;

    const target = e.target as HTMLElement;
    const interactive = target.closest('button, input, textarea, [role="button"]');
    if (interactive) return;

    toggleSelect(key);
  };

  const allCurrentPageSelected = (() => {
    const docs = documentsData?.documents ?? [];
    return docs.length > 0 && docs.every(doc => selectedKeys.has(doc.key));
  })();

  return (
    <>
      <DashboardHeader
        icon={DatabaseIcon}
        title='Storage Management'
        description='Manage documents in R2 storage'
      />

      {/* Info Banner */}
      <div className='mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4'>
        <p className='text-sm text-blue-800'>
          <strong>Note:</strong> This dashboard shows all PDFs in R2 storage. PDFs marked as
          &quot;Orphaned&quot; are files in R2 that are not tracked in the mediaFiles database table
          (e.g., from failed cleanup). You can safely delete orphaned PDFs to free up storage space.
        </p>
      </div>

      {/* Filters and Search */}
      <div className='mb-6 flex flex-col gap-4 sm:flex-row'>
        <div className='relative flex-1'>
          <SearchIcon className='text-muted-foreground/70 absolute top-1/2 left-3 size-4 -translate-y-1/2' />
          <input
            type='text'
            placeholder='Search by file name...'
            value={search}
            onChange={handleSearchInput}
            className={`w-full ${input.base} ${input.withIconLeft}`}
          />
        </div>
        <div className='sm:w-64'>
          <input
            type='text'
            placeholder='Filter by prefix (e.g., projects/{id}/)'
            value={prefix}
            onChange={handlePrefixChange}
            className={`w-full ${input.base}`}
          />
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedKeys.size > 0 && (
        <div className='mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4'>
          <span className='text-sm font-medium text-blue-900'>
            {selectedKeys.size} document{selectedKeys.size === 1 ? '' : 's'} selected
          </span>
          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={() => setSelectedKeys(new Set())}
              className='text-secondary-foreground hover:bg-muted bg-card rounded-lg px-4 py-2 text-sm font-medium'
            >
              Clear Selection
            </button>
            <button
              type='button'
              onClick={handleBulkDelete}
              className='rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:ring-2 focus:ring-blue-500 focus:outline-none'
            >
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Documents Table */}
      <AdminSection title='Documents'>
        <AdminBox padding='compact' className='overflow-hidden p-0'>
          <Table>
            <TableHeader className='border-border bg-muted border-b'>
              <TableRow className='border-border border-b'>
                <TableHead className='px-6 py-3'>
                  <button
                    type='button'
                    onClick={toggleSelectAll}
                    className='text-muted-foreground/70 hover:text-muted-foreground flex items-center'
                    title='Select all'
                  >
                    {allCurrentPageSelected ?
                      <CheckSquareIcon className='size-4 text-blue-600' />
                    : <SquareIcon className='size-4' />}
                  </button>
                </TableHead>
                <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                  File Name
                </TableHead>
                <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                  Size
                </TableHead>
                <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                  Project ID
                </TableHead>
                <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                  Study ID
                </TableHead>
                <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                  Uploaded
                </TableHead>
                <TableHead className='text-muted-foreground px-6 py-3 text-right text-xs font-medium tracking-wider uppercase'>
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documentsDataQuery.isLoading ?
                <TableRow>
                  <TableCell colSpan={7} className='px-6 py-12 text-center'>
                    <div className='flex items-center justify-center'>
                      <LoaderIcon className='size-8 animate-spin text-blue-600' />
                    </div>
                  </TableCell>
                </TableRow>
              : (documentsData?.documents ?? []).length > 0 ?
                (documentsData?.documents ?? []).map(doc => (
                  <TableRow
                    key={doc.key}
                    className={doc.orphaned ? 'bg-orange-50' : ''}
                    onClick={e => handleRowClick(e, doc.key)}
                  >
                    <TableCell className='text-foreground px-6 py-4 text-sm'>
                      <button
                        type='button'
                        onClick={e => {
                          e.stopPropagation();
                          toggleSelect(doc.key);
                        }}
                        className='text-muted-foreground/70 hover:text-muted-foreground'
                      >
                        {selectedKeys.has(doc.key) ?
                          <CheckSquareIcon className='size-4 text-blue-600' />
                        : <SquareIcon className='size-4' />}
                      </button>
                    </TableCell>
                    <TableCell className='text-foreground px-6 py-4 text-sm'>
                      <div className='flex items-center gap-2'>
                        <span className='text-foreground font-mono text-sm'>{doc.fileName}</span>
                        {doc.orphaned && (
                          <Badge
                            variant='warning'
                            title='Orphaned: File exists in R2 but is not tracked in mediaFiles database table'
                          >
                            Orphaned
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className='text-muted-foreground px-6 py-4 text-sm'>
                      {formatFileSize(doc.size)}
                    </TableCell>
                    <TableCell className='text-foreground px-6 py-4 text-sm'>
                      <span className='text-muted-foreground font-mono text-xs'>
                        {doc.projectId}
                      </span>
                    </TableCell>
                    <TableCell className='text-foreground px-6 py-4 text-sm'>
                      <span className='text-muted-foreground font-mono text-xs'>{doc.studyId}</span>
                    </TableCell>
                    <TableCell className='text-muted-foreground px-6 py-4 text-sm'>
                      {formatDate(doc.uploaded)}
                    </TableCell>
                    <TableCell className='text-foreground px-6 py-4 text-right text-sm'>
                      <button
                        type='button'
                        onClick={e => {
                          e.stopPropagation();
                          handleSingleDelete(doc.key);
                        }}
                        className='text-destructive hover:bg-destructive/10 rounded-lg p-2'
                        title='Delete'
                      >
                        <Trash2Icon className='size-4' />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              : <TableRow>
                  <TableCell colSpan={7} className='text-muted-foreground px-6 py-12 text-center'>
                    No documents found
                  </TableCell>
                </TableRow>
              }
            </TableBody>
          </Table>

          {/* Pagination */}
          {documentsData && (
            <div className='border-border flex items-center justify-between border-t px-6 py-4'>
              <div className='flex flex-col gap-1'>
                <p className='text-muted-foreground text-sm'>
                  Showing {documentsData.documents?.length ?? 0} document
                  {documentsData.documents?.length === 1 ? '' : 's'}
                </p>
                {documentsData.truncated && (
                  <p className='text-xs text-orange-600'>
                    Results truncated after processing 10,000 objects. Use pagination to continue.
                  </p>
                )}
              </div>
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={handlePrevPage}
                  disabled={cursorHistory.length === 0}
                  className='hover:bg-muted border-border bg-card rounded-xl border p-2 shadow-xs disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <ChevronLeftIcon className='size-4' />
                </button>
                <span className='text-muted-foreground text-sm'>
                  {cursorHistory.length + 1}
                  {documentsData.nextCursor ? ' ->' : ''}
                </span>
                <button
                  type='button'
                  onClick={handleNextPage}
                  disabled={!documentsData.nextCursor}
                  className='hover:bg-muted border-border bg-card rounded-xl border p-2 shadow-xs disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <ChevronRightIcon className='size-4' />
                </button>
              </div>
            </div>
          )}
        </AdminBox>
      </AdminSection>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteKeys} onOpenChange={_open => !_open && setDeleteKeys(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Documents</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteKeys?.length ?? 0} document
              {deleteKeys?.length === 1 ? '' : 's'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={handleDelete} disabled={loading}>
              {loading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
