/**
 * GoogleDrivePickerModal - Modal for browsing and selecting PDFs from Google Drive
 */

import { createSignal, createEffect, For, Show } from 'solid-js';
import { Dialog } from '@components/zag/Dialog.jsx';
import { showToast } from '@components/zag/Toast.jsx';
import { FaBrandsGoogleDrive } from 'solid-icons/fa';
import { FiSearch, FiFile, FiChevronRight, FiExternalLink } from 'solid-icons/fi';
import { BiRegularImport } from 'solid-icons/bi';
import {
  listGoogleDriveFiles,
  importFromGoogleDrive,
  getGoogleDriveStatus,
  connectGoogleAccount,
  formatFileSize,
  formatDate,
} from '@/api/google-drive.js';

/**
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is open
 * @param {Function} props.onClose - Called when modal should close
 * @param {string} props.projectId - Project ID to import into
 * @param {string} props.studyId - Study ID to import into
 * @param {Function} [props.onImportSuccess] - Called after successful import with file info
 */
export default function GoogleDrivePickerModal(props) {
  const [loading, setLoading] = createSignal(true);
  const [files, setFiles] = createSignal([]);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [nextPageToken, setNextPageToken] = createSignal(null);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [selectedFile, setSelectedFile] = createSignal(null);
  const [importing, setImporting] = createSignal(false);
  const [connected, setConnected] = createSignal(null); // null = checking, true/false = known
  const [error, setError] = createSignal(null);

  // Check connection status and load files when modal opens
  createEffect(() => {
    if (props.open) {
      checkConnectionAndLoad();
    } else {
      // Reset state when modal closes
      setFiles([]);
      setSearchQuery('');
      setNextPageToken(null);
      setSelectedFile(null);
      setError(null);
    }
  });

  const checkConnectionAndLoad = async () => {
    setLoading(true);
    setError(null);

    try {
      const status = await getGoogleDriveStatus();
      setConnected(status.connected);

      if (status.connected) {
        await loadFiles();
      }
    } catch (err) {
      console.error('Error checking Google Drive status:', err);
      setError('Failed to check Google Drive connection');
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async (append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await listGoogleDriveFiles({
        query: searchQuery() || undefined,
        pageToken: append ? nextPageToken() : undefined,
        pageSize: 20,
      });

      if (append) {
        setFiles(prev => [...prev, ...result.files]);
      } else {
        setFiles(result.files);
      }
      setNextPageToken(result.nextPageToken);
    } catch (err) {
      console.error('Error loading Google Drive files:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Debounced search
  let searchTimeout;
  const handleSearchInput = value => {
    setSearchQuery(value);
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadFiles();
    }, 300);
  };

  const handleImport = async () => {
    const file = selectedFile();
    if (!file || !props.projectId || !props.studyId) return;

    setImporting(true);

    try {
      const result = await importFromGoogleDrive(file.id, props.projectId, props.studyId);

      showToast.success('PDF Imported', `Successfully imported "${file.name}" from Google Drive.`);

      props.onImportSuccess?.(result.file);
      props.onClose();
    } catch (err) {
      console.error('Import error:', err);
      showToast.error('Import Failed', err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      await connectGoogleAccount(window.location.href);
    } catch (err) {
      console.error('Error connecting Google:', err);
      showToast.error('Error', 'Failed to connect Google account.');
    }
  };

  return (
    <Dialog
      open={props.open}
      onOpenChange={open => !open && props.onClose()}
      title='Import from Google Drive'
      description='Select a PDF from your Google Drive to import'
      size='lg'
    >
      <div class='space-y-4'>
        {/* Loading state */}
        <Show when={loading() && connected() === null}>
          <div class='flex items-center justify-center py-12'>
            <div class='w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
          </div>
        </Show>

        {/* Not connected state */}
        <Show when={!loading() && connected() === false}>
          <div class='text-center py-8'>
            <FaBrandsGoogleDrive class='w-16 h-16 text-gray-300 mx-auto mb-4' />
            <h3 class='text-lg font-medium text-gray-900 mb-2'>Connect Google Drive</h3>
            <p class='text-sm text-gray-500 mb-6 max-w-sm mx-auto'>
              Connect your Google account to browse and import PDFs from your Google Drive.
            </p>
            <button
              type='button'
              onClick={handleConnectGoogle}
              class='inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors'
            >
              <FaBrandsGoogleDrive class='w-4 h-4' />
              Connect Google Account
            </button>
          </div>
        </Show>

        {/* Connected - show file browser */}
        <Show when={connected()}>
          {/* Search bar */}
          <div class='relative'>
            <FiSearch class='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
            <input
              type='text'
              placeholder='Search PDFs in your Drive...'
              value={searchQuery()}
              onInput={e => handleSearchInput(e.target.value)}
              class='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            />
          </div>

          {/* Error state */}
          <Show when={error()}>
            <div class='p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700'>
              {error()}
            </div>
          </Show>

          {/* Loading files */}
          <Show when={loading() && !error()}>
            <div class='flex items-center justify-center py-8'>
              <div class='w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
              <span class='ml-2 text-sm text-gray-500'>Loading files...</span>
            </div>
          </Show>

          {/* Files list */}
          <Show when={!loading() && !error()}>
            <Show
              when={files().length > 0}
              fallback={
                <div class='text-center py-8 text-gray-500'>
                  <FiFile class='w-10 h-10 text-gray-300 mx-auto mb-2' />
                  <p class='text-sm'>
                    {searchQuery() ?
                      'No PDFs found matching your search.'
                    : 'No PDFs found in your Google Drive.'}
                  </p>
                </div>
              }
            >
              <div class='max-h-80 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100'>
                <For each={files()}>
                  {file => (
                    <button
                      type='button'
                      onClick={() => setSelectedFile(file)}
                      class={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors ${
                        selectedFile()?.id === file.id ? 'bg-blue-50 hover:bg-blue-100' : ''
                      }`}
                    >
                      <div class='shrink-0'>
                        <FiFile class='w-8 h-8 text-red-500' />
                      </div>
                      <div class='flex-1 min-w-0'>
                        <p class='text-sm font-medium text-gray-900 truncate'>{file.name}</p>
                        <p class='text-xs text-gray-500'>
                          {formatFileSize(file.size)} - Modified {formatDate(file.modifiedTime)}
                        </p>
                      </div>
                      <Show when={file.webViewLink}>
                        <a
                          href={file.webViewLink}
                          target='_blank'
                          rel='noopener noreferrer'
                          onClick={e => e.stopPropagation()}
                          class='p-1 text-gray-400 hover:text-blue-600'
                          title='Open in Google Drive'
                        >
                          <FiExternalLink class='w-4 h-4' />
                        </a>
                      </Show>
                      <Show when={selectedFile()?.id === file.id}>
                        <FiChevronRight class='w-4 h-4 text-blue-600' />
                      </Show>
                    </button>
                  )}
                </For>
              </div>

              {/* Load more button */}
              <Show when={nextPageToken()}>
                <div class='text-center pt-2'>
                  <button
                    type='button'
                    onClick={() => loadFiles(true)}
                    disabled={loadingMore()}
                    class='text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50'
                  >
                    {loadingMore() ? 'Loading...' : 'Load more files'}
                  </button>
                </div>
              </Show>
            </Show>
          </Show>
        </Show>

        {/* Action buttons */}
        <div class='flex justify-end gap-2 pt-2 border-t border-gray-200'>
          <button
            type='button'
            onClick={() => props.onClose()}
            class='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors'
          >
            Cancel
          </button>
          <Show when={connected() && selectedFile()}>
            <button
              type='button'
              onClick={handleImport}
              disabled={importing()}
              class='px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
            >
              <Show
                when={!importing()}
                fallback={
                  <div class='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
                }
              >
                <BiRegularImport class='w-4 h-4' />
              </Show>
              {importing() ? 'Importing...' : 'Import PDF'}
            </button>
          </Show>
        </div>
      </div>
    </Dialog>
  );
}
