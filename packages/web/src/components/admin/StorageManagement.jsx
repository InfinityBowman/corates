/**
 * Storage Management - Admin interface for managing R2 documents
 */

import { createSignal, Show, For } from 'solid-js';
import { useDebouncedSignal } from '@/primitives/useDebouncedSignal.js';
import {
  FiTrash2,
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
  FiDatabase,
  FiCheckSquare,
  FiSquare,
  FiLoader,
  FiX,
} from 'solid-icons/fi';
import { deleteStorageDocuments } from '@/stores/adminStore.js';
import { useStorageDocuments } from '@primitives/useAdminQueries.js';
import { showToast } from '@/components/ui/toast';
import {
  Dialog,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { DashboardHeader, AdminSection, AdminBox } from './ui/index.js';
import { input, table } from './styles/admin-tokens.js';

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Storage Management component for admin dashboard
 * Manages R2 documents with search, prefix filtering, and pagination
 * Allows admins to view, filter, and delete PDF documents stored in R2
 * @returns {JSX.Element} - The StorageManagement component
 */
export default function StorageManagement() {
  const [search, setSearch, debouncedSearch] = useDebouncedSignal('', 300);
  const [prefix, setPrefix] = createSignal('');
  const [cursor, setCursor] = createSignal(null);
  const [cursorHistory, setCursorHistory] = createSignal([]);
  const [selectedKeys, setSelectedKeys] = createSignal(new Set());
  const [deleteDialog, setDeleteDialog] = createSignal(null);
  const [loading, setLoading] = createSignal(false);

  const limit = 50;

  // Fetch documents with cursor-based pagination using TanStack Query
  const documentsDataQuery = useStorageDocuments(() => ({
    cursor: cursor(),
    limit,
    prefix: prefix(),
    search: debouncedSearch(),
  }));
  const documentsData = () => documentsDataQuery.data;

  // Handle search input - reset pagination when search changes
  const handleSearchInput = e => {
    setSearch(e.target.value);
    setCursor(null);
    setCursorHistory([]);
    setSelectedKeys(new Set());
  };

  const handlePrefixChange = e => {
    setPrefix(e.target.value);
    setCursor(null);
    setCursorHistory([]);
    setSelectedKeys(new Set());
  };

  const handleNextPage = () => {
    const data = documentsData();
    if (data?.nextCursor) {
      setCursorHistory(prev => [...prev, cursor()]);
      setCursor(data.nextCursor);
    }
  };

  const handlePrevPage = () => {
    const history = cursorHistory();
    if (history.length > 0) {
      const prevCursor = history[history.length - 1];
      setCursorHistory(prev => prev.slice(0, -1));
      setCursor(prevCursor);
    } else {
      setCursor(null);
    }
  };

  const toggleSelect = key => {
    const newSet = new Set(selectedKeys());
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedKeys(newSet);
  };

  const toggleSelectAll = () => {
    const docs = documentsData()?.documents || [];
    const currentKeys = new Set(docs.map(d => d.key));
    const selected = selectedKeys();

    // Check if all current page documents are selected
    const allCurrentPageSelected = docs.length > 0 && docs.every(doc => selected.has(doc.key));

    if (allCurrentPageSelected) {
      // Deselect only current page documents, keep other selections
      const newSet = new Set(selected);
      currentKeys.forEach(key => newSet.delete(key));
      setSelectedKeys(newSet);
    } else {
      // Select all current page documents, keep other selections
      const newSet = new Set(selected);
      currentKeys.forEach(key => newSet.add(key));
      setSelectedKeys(newSet);
    }
  };

  const handleDelete = async () => {
    const keysToDelete = deleteDialog();
    if (!keysToDelete || keysToDelete.length === 0) return;

    setLoading(true);
    try {
      const result = await deleteStorageDocuments(keysToDelete);
      setDeleteDialog(null);
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
      showToast.error('Delete Failed', error.message || 'Failed to delete documents');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = () => {
    const keys = Array.from(selectedKeys());
    if (keys.length === 0) return;
    setDeleteDialog(keys);
  };

  const handleSingleDelete = key => {
    setDeleteDialog([key]);
  };

  const handleRowClick = (e, key) => {
    // Don't toggle if user is selecting text
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }

    // Don't toggle if clicking on interactive elements
    const target = e.target;
    const interactive = target.closest('button, input, textarea, [role="button"]');
    if (interactive) {
      return;
    }

    // Toggle selection
    toggleSelect(key);
  };

  return (
    <>
      <DashboardHeader
        icon={FiDatabase}
        title='Storage Management'
        description='Manage documents in R2 storage'
      />

      {/* Info Banner */}
      <div class='mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4'>
        <p class='text-sm text-blue-800'>
          <strong>Note:</strong> This dashboard shows all PDFs in R2 storage. PDFs marked as
          "Orphaned" are files in R2 that are not tracked in the mediaFiles database table (e.g.,
          from failed cleanup). You can safely delete orphaned PDFs to free up storage space.
        </p>
      </div>

      {/* Filters and Search */}
      <div class='mb-6 flex flex-col gap-4 sm:flex-row'>
        <div class='relative flex-1'>
          <FiSearch class='text-muted-foreground/70 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
          <input
            type='text'
            placeholder='Search by file name...'
            value={search()}
            onInput={handleSearchInput}
            class={`w-full ${input.base} ${input.withIconLeft}`}
          />
        </div>
        <div class='sm:w-64'>
          <input
            type='text'
            placeholder='Filter by prefix (e.g., projects/{id}/)'
            value={prefix()}
            onInput={handlePrefixChange}
            class={`w-full ${input.base}`}
          />
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <Show when={selectedKeys().size > 0}>
        <div class='mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4'>
          <span class='text-sm font-medium text-blue-900'>
            {selectedKeys().size} document{selectedKeys().size === 1 ? '' : 's'} selected
          </span>
          <div class='flex items-center gap-3'>
            <button
              onClick={() => setSelectedKeys(new Set())}
              class='text-secondary-foreground hover:bg-muted bg-card rounded-lg px-4 py-2 text-sm font-medium'
            >
              Clear Selection
            </button>
            <button
              onClick={handleBulkDelete}
              class='rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:ring-2 focus:ring-blue-500 focus:outline-none'
            >
              Delete Selected
            </button>
          </div>
        </div>
      </Show>

      {/* Documents Table */}
      <AdminSection title='Documents'>
        <AdminBox padding='compact' class='overflow-hidden p-0'>
          <div class='overflow-x-auto'>
            <table class={table.base}>
              <thead class={table.header}>
                <tr class='border-border border-b'>
                  <th class='px-6 py-3 text-left'>
                    <button
                      onClick={toggleSelectAll}
                      class='text-muted-foreground/70 hover:text-muted-foreground flex items-center'
                      title='Select all'
                    >
                      <Show
                        when={(() => {
                          const docs = documentsData()?.documents || [];
                          const selected = selectedKeys();
                          return docs.length > 0 && docs.every(doc => selected.has(doc.key));
                        })()}
                        fallback={<FiSquare class='h-4 w-4' />}
                      >
                        <FiCheckSquare class='h-4 w-4 text-blue-600' />
                      </Show>
                    </button>
                  </th>
                  <th class={table.headerCell}>File Name</th>
                  <th class={table.headerCell}>Size</th>
                  <th class={table.headerCell}>Project ID</th>
                  <th class={table.headerCell}>Study ID</th>
                  <th class={table.headerCell}>Uploaded</th>
                  <th class={`${table.headerCell} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody class={table.body}>
                <Show
                  when={!documentsDataQuery.isLoading}
                  fallback={
                    <tr>
                      <td colspan='7' class='px-6 py-12 text-center'>
                        <div class='flex items-center justify-center'>
                          <FiLoader class='h-8 w-8 animate-spin text-blue-600' />
                        </div>
                      </td>
                    </tr>
                  }
                >
                  <For
                    each={documentsData()?.documents || []}
                    fallback={
                      <tr>
                        <td colspan='7' class='text-muted-foreground px-6 py-12 text-center'>
                          No documents found
                        </td>
                      </tr>
                    }
                  >
                    {doc => (
                      <tr
                        class={`${table.row} ${doc.orphaned ? 'bg-orange-50' : ''}`}
                        onClick={e => handleRowClick(e, doc.key)}
                      >
                        <td class={table.cell}>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              toggleSelect(doc.key);
                            }}
                            class='text-muted-foreground/70 hover:text-muted-foreground'
                          >
                            <Show
                              when={selectedKeys().has(doc.key)}
                              fallback={<FiSquare class='h-4 w-4' />}
                            >
                              <FiCheckSquare class='h-4 w-4 text-blue-600' />
                            </Show>
                          </button>
                        </td>
                        <td class={table.cell}>
                          <div class='flex items-center gap-2'>
                            <span class='text-foreground font-mono text-sm'>{doc.fileName}</span>
                            <Show when={doc.orphaned}>
                              <span
                                class='inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800'
                                title='Orphaned: File exists in R2 but is not tracked in mediaFiles database table'
                              >
                                Orphaned
                              </span>
                            </Show>
                          </div>
                        </td>
                        <td class={`${table.cell} text-muted-foreground`}>
                          {formatFileSize(doc.size)}
                        </td>
                        <td class={table.cell}>
                          <span class='text-muted-foreground font-mono text-xs'>
                            {doc.projectId}
                          </span>
                        </td>
                        <td class={table.cell}>
                          <span class='text-muted-foreground font-mono text-xs'>{doc.studyId}</span>
                        </td>
                        <td class={`${table.cell} text-muted-foreground`}>
                          {formatDate(doc.uploaded)}
                        </td>
                        <td class={`${table.cell} text-right`}>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleSingleDelete(doc.key);
                            }}
                            class='rounded-lg p-2 text-red-600 hover:bg-red-50'
                            title='Delete'
                          >
                            <FiTrash2 class='h-4 w-4' />
                          </button>
                        </td>
                      </tr>
                    )}
                  </For>
                </Show>
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <Show when={documentsData()}>
            <div class='border-border flex items-center justify-between border-t px-6 py-4'>
              <div class='flex flex-col gap-1'>
                <p class='text-muted-foreground text-sm'>
                  Showing {documentsData()?.documents?.length || 0} document
                  {documentsData()?.documents?.length === 1 ? '' : 's'}
                </p>
                <Show when={documentsData()?.truncated}>
                  <p class='text-xs text-orange-600'>
                    Results truncated after processing 10,000 objects. Use pagination to continue.
                  </p>
                </Show>
              </div>
              <div class='flex items-center space-x-2'>
                <button
                  onClick={handlePrevPage}
                  disabled={cursorHistory().length === 0}
                  class='hover:bg-muted border-border bg-card rounded-xl border p-2 shadow-xs disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <FiChevronLeft class='h-4 w-4' />
                </button>
                <span class='text-muted-foreground text-sm'>
                  {cursorHistory().length + 1}
                  {documentsData()?.nextCursor ? ' ->' : ''}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={!documentsData()?.nextCursor}
                  class='hover:bg-muted border-border bg-card rounded-xl border p-2 shadow-xs disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <FiChevronRight class='h-4 w-4' />
                </button>
              </div>
            </div>
          </Show>
        </AdminBox>
      </AdminSection>
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog()} onOpenChange={open => !open && setDeleteDialog(null)}>
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent class='max-w-md'>
            <DialogHeader>
              <DialogTitle>Delete Documents</DialogTitle>
              <DialogCloseTrigger aria-label='Close'>
                <FiX class='h-5 w-5' />
              </DialogCloseTrigger>
            </DialogHeader>
            <DialogBody>
              <div class='space-y-4'>
                <p class='text-muted-foreground text-sm'>
                  Are you sure you want to delete {deleteDialog()?.length || 0} document
                  {deleteDialog()?.length === 1 ? '' : 's'}? This action cannot be undone.
                </p>
                <div class='flex justify-end space-x-3'>
                  <button
                    onClick={() => setDeleteDialog(null)}
                    disabled={loading()}
                    class='text-secondary-foreground bg-secondary hover:bg-secondary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50'
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={loading()}
                    class='rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50'
                  >
                    {loading() ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </DialogBody>
          </DialogContent>
        </DialogPositioner>
      </Dialog>
    </>
  );
}
