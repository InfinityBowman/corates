/**
 * Storage Management - Admin interface for managing R2 documents
 */

import { createSignal, Show, For, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import {
  FiTrash2,
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
  FiDatabase,
  FiAlertCircle,
  FiCheckSquare,
  FiSquare,
} from 'solid-icons/fi';
import {
  isAdmin,
  isAdminChecked,
  checkAdminStatus,
  deleteStorageDocuments,
} from '@/stores/adminStore.js';
import { useStorageDocuments } from '@primitives/useAdminQueries.js';
import { Dialog, showToast } from '@corates/ui';

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

export default function StorageManagement() {
  const navigate = useNavigate();
  const [search, setSearch] = createSignal('');
  const [prefix, setPrefix] = createSignal('');
  const [cursor, setCursor] = createSignal(null);
  const [cursorHistory, setCursorHistory] = createSignal([]);
  const [debouncedSearch, setDebouncedSearch] = createSignal('');
  const [selectedKeys, setSelectedKeys] = createSignal(new Set());
  const [deleteDialog, setDeleteDialog] = createSignal(null);
  const [loading, setLoading] = createSignal(false);

  const limit = 50;

  // Check admin status on mount
  onMount(async () => {
    await checkAdminStatus();
    if (!isAdmin()) {
      navigate('/dashboard');
    }
  });

  // Fetch documents with cursor-based pagination using TanStack Query
  const documentsDataQuery = useStorageDocuments(() => ({
    cursor: cursor(),
    limit,
    prefix: prefix(),
    search: debouncedSearch(),
  }));
  const documentsData = () => documentsDataQuery.data;

  // Debounce search
  let searchTimeout;
  const handleSearchInput = e => {
    setSearch(e.target.value);
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      setDebouncedSearch(e.target.value);
      setCursor(null);
      setCursorHistory([]);
      setSelectedKeys(new Set());
    }, 300);
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
    <Show
      when={isAdminChecked()}
      fallback={
        <div class='flex min-h-100 items-center justify-center'>
          <div class='h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600' />
        </div>
      }
    >
      <Show
        when={isAdmin()}
        fallback={
          <div class='flex min-h-100 flex-col items-center justify-center text-gray-500'>
            <FiAlertCircle class='mb-4 h-12 w-12' />
            <p class='text-lg font-medium'>Access Denied</p>
            <p class='text-sm'>You do not have admin privileges.</p>
          </div>
        }
      >
        <div class='mx-auto max-w-7xl p-6'>
          {/* Header */}
          <div class='mb-8 flex items-center justify-between'>
            <div class='flex items-center space-x-3'>
              <button
                onClick={() => navigate('/admin')}
                class='text-gray-400 transition-colors hover:text-gray-700'
                title='Back to Admin Dashboard'
              >
                <FiChevronLeft class='h-6 w-6' />
              </button>
              <div class='rounded-lg bg-blue-100 p-2'>
                <FiDatabase class='h-6 w-6 text-blue-600' />
              </div>
              <div>
                <h1 class='text-2xl font-bold text-gray-900'>Storage Management</h1>
                <p class='text-sm text-gray-500'>Manage documents in R2 storage</p>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <div class='mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4'>
            <p class='text-sm text-blue-800'>
              <strong>Note:</strong> This dashboard shows all PDFs in R2 storage. PDFs marked as
              "Orphaned" have a project ID that no longer exists in the database (e.g., from failed
              cleanup when projects were deleted). You can safely delete orphaned PDFs to free up
              storage space.
            </p>
          </div>

          {/* Filters and Search */}
          <div class='mb-6 flex flex-col gap-4 sm:flex-row'>
            <div class='relative flex-1'>
              <FiSearch class='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400' />
              <input
                type='text'
                placeholder='Search by file name...'
                value={search()}
                onInput={handleSearchInput}
                class='w-full rounded-lg border border-gray-300 py-2 pr-4 pl-9 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none'
              />
            </div>
            <div class='sm:w-64'>
              <input
                type='text'
                placeholder='Filter by prefix (e.g., projects/{id}/)'
                value={prefix()}
                onInput={handlePrefixChange}
                class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none'
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
                  class='rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
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
          <div class='rounded-lg border border-gray-200 bg-white shadow-sm'>
            <div class='overflow-x-auto'>
              <table class='w-full'>
                <thead>
                  <tr class='border-b border-gray-200 bg-gray-50'>
                    <th class='px-6 py-3 text-left'>
                      <button
                        onClick={toggleSelectAll}
                        class='flex items-center text-gray-400 hover:text-gray-600'
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
                    <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                      File Name
                    </th>
                    <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                      Size
                    </th>
                    <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                      Project ID
                    </th>
                    <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                      Study ID
                    </th>
                    <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                      Uploaded
                    </th>
                    <th class='px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase'>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody class='divide-y divide-gray-200'>
                  <Show
                    when={!documentsDataQuery.isLoading}
                    fallback={
                      <tr>
                        <td colspan='7' class='px-6 py-12 text-center'>
                          <div class='flex items-center justify-center'>
                            <div class='h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600' />
                          </div>
                        </td>
                      </tr>
                    }
                  >
                    <For
                      each={documentsData()?.documents || []}
                      fallback={
                        <tr>
                          <td colspan='7' class='px-6 py-12 text-center text-gray-500'>
                            No documents found
                          </td>
                        </tr>
                      }
                    >
                      {doc => (
                        <tr
                          class={`hover:bg-gray-50 ${doc.orphaned ? 'bg-orange-50' : ''}`}
                          onClick={e => handleRowClick(e, doc.key)}
                        >
                          <td class='px-6 py-4'>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                toggleSelect(doc.key);
                              }}
                              class='text-gray-400 hover:text-gray-600'
                            >
                              <Show
                                when={selectedKeys().has(doc.key)}
                                fallback={<FiSquare class='h-4 w-4' />}
                              >
                                <FiCheckSquare class='h-4 w-4 text-blue-600' />
                              </Show>
                            </button>
                          </td>
                          <td class='px-6 py-4'>
                            <div class='flex items-center gap-2'>
                              <span class='font-mono text-sm text-gray-900'>{doc.fileName}</span>
                              <Show when={doc.orphaned}>
                                <span
                                  class='inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800'
                                  title='Orphaned: Project no longer exists in database'
                                >
                                  Orphaned
                                </span>
                              </Show>
                            </div>
                          </td>
                          <td class='px-6 py-4 text-sm text-gray-600'>
                            {formatFileSize(doc.size)}
                          </td>
                          <td class='px-6 py-4'>
                            <span class='font-mono text-xs text-gray-600'>{doc.projectId}</span>
                          </td>
                          <td class='px-6 py-4'>
                            <span class='font-mono text-xs text-gray-600'>{doc.studyId}</span>
                          </td>
                          <td class='px-6 py-4 text-sm text-gray-500'>
                            {formatDate(doc.uploaded)}
                          </td>
                          <td class='px-6 py-4 text-right'>
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
              <div class='flex items-center justify-between border-t border-gray-200 px-6 py-4'>
                <div class='flex flex-col gap-1'>
                  <p class='text-sm text-gray-500'>
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
                    class='rounded-lg border border-gray-300 p-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    <FiChevronLeft class='h-4 w-4' />
                  </button>
                  <span class='text-sm text-gray-600'>
                    {cursorHistory().length + 1}
                    {documentsData()?.nextCursor ? ' →' : ''}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={!documentsData()?.nextCursor}
                    class='rounded-lg border border-gray-300 p-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    <FiChevronRight class='h-4 w-4' />
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={!!deleteDialog()}
          onOpenChange={open => !open && setDeleteDialog(null)}
          title='Delete Documents'
          role='alertdialog'
        >
          <div class='space-y-4'>
            <p class='text-sm text-gray-600'>
              Are you sure you want to delete {deleteDialog()?.length || 0} document
              {deleteDialog()?.length === 1 ? '' : 's'}? This action cannot be undone.
            </p>
            <div class='flex justify-end space-x-3'>
              <button
                onClick={() => setDeleteDialog(null)}
                disabled={loading()}
                class='rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50'
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
        </Dialog>
      </Show>
    </Show>
  );
}
