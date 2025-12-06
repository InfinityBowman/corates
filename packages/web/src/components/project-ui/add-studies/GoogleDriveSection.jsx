/**
 * GoogleDriveSection - Google Drive file picker for AddStudiesForm
 * Allows selecting multiple PDFs from Google Drive to create studies
 */

import { createSignal, createEffect, For, Show } from 'solid-js';
import { BiRegularTrash } from 'solid-icons/bi';
import { FiSearch, FiFile, FiExternalLink, FiCheck } from 'solid-icons/fi';
import {
  listGoogleDriveFiles,
  getGoogleDriveStatus,
  connectGoogleAccount,
  formatFileSize,
  formatDate,
} from '@/api/google-drive.js';

/**
 * @param {Object} props
 * @param {Array} props.selectedFiles - Currently selected Google Drive files
 * @param {Function} props.onToggleFile - Toggle selection of a file
 * @param {Function} props.onRemoveFile - Remove a file from selection
 * @param {Function} props.onClear - Clear all selected files
 */
export default function GoogleDriveSection(props) {
  const [loading, setLoading] = createSignal(true);
  const [files, setFiles] = createSignal([]);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [nextPageToken, setNextPageToken] = createSignal(null);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [connected, setConnected] = createSignal(null);
  const [error, setError] = createSignal(null);
  const [showBrowser, setShowBrowser] = createSignal(false);

  // Check connection status on mount
  createEffect(() => {
    checkConnectionStatus();
  });

  const checkConnectionStatus = async () => {
    try {
      const status = await getGoogleDriveStatus();
      setConnected(status.connected);
    } catch (err) {
      console.error('Error checking Google Drive status:', err);
      setConnected(false);
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

  const handleOpenBrowser = async () => {
    setShowBrowser(true);
    if (connected()) {
      await loadFiles();
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

  const handleConnectGoogle = async () => {
    try {
      await connectGoogleAccount(window.location.href);
    } catch (err) {
      console.error('Error connecting Google:', err);
    }
  };

  const isFileSelected = fileId => {
    return props.selectedFiles().some(f => f.id === fileId);
  };

  const selectedCount = () => props.selectedFiles().length;

  return (
    <div class='space-y-3'>
      <p class='text-sm text-gray-500'>
        Import PDFs from your Google Drive. Each selected file will create a new study.
      </p>

      {/* Selected files display */}
      <Show when={selectedCount() > 0}>
        <div class='space-y-2'>
          <div class='flex items-center justify-between'>
            <span class='text-sm font-medium text-gray-700'>
              {selectedCount()} {selectedCount() === 1 ? 'file' : 'files'} selected
            </span>
            <button
              type='button'
              onClick={() => props.onClear()}
              class='text-xs text-gray-500 hover:text-red-600 transition-colors'
            >
              Clear all
            </button>
          </div>
          <div class='space-y-2 max-h-40 overflow-y-auto'>
            <For each={props.selectedFiles()}>
              {file => (
                <div class='flex items-center gap-3 p-2 bg-blue-50 rounded-lg border border-blue-200'>
                  <FiFile class='w-4 h-4 text-red-500 shrink-0' />
                  <div class='flex-1 min-w-0'>
                    <p class='text-sm font-medium text-gray-900 truncate'>{file.name}</p>
                    <p class='text-xs text-gray-500'>{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type='button'
                    onClick={() => props.onRemoveFile(file.id)}
                    class='p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors'
                  >
                    <BiRegularTrash class='w-4 h-4' />
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Browse button or browser */}
      <Show
        when={showBrowser()}
        fallback={
          <button
            type='button'
            onClick={handleOpenBrowser}
            disabled={loading()}
            class='w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors'
          >
            <Show
              when={!loading()}
              fallback={
                <div class='w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin' />
              }
            >
              <img src='/logos/drive.svg' alt='' class='w-5 h-5' />
            </Show>
            <span class='text-sm font-medium'>
              {loading() ? 'Checking connection...' : 'Browse Google Drive'}
            </span>
          </button>
        }
      >
        <div class='border border-gray-200 rounded-lg overflow-hidden'>
          {/* Not connected state */}
          <Show when={connected() === false}>
            <div class='text-center py-6 px-4'>
              <img src='/logos/drive.svg' alt='Google Drive' class='w-12 h-12 mx-auto mb-3' />
              <h4 class='text-sm font-medium text-gray-900 mb-1'>Connect Google Drive</h4>
              <p class='text-xs text-gray-500 mb-4'>
                Connect your Google account to browse and import PDFs.
              </p>
              <button
                type='button'
                onClick={handleConnectGoogle}
                class='inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors'
              >
                <img src='/logos/drive.svg' alt='' class='w-4 h-4' />
                Connect Google Account
              </button>
            </div>
          </Show>

          {/* Connected - show file browser */}
          <Show when={connected()}>
            {/* Search bar */}
            <div class='p-2 border-b border-gray-200 bg-gray-50'>
              <div class='relative'>
                <FiSearch class='absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                <input
                  type='text'
                  placeholder='Search PDFs...'
                  value={searchQuery()}
                  onInput={e => handleSearchInput(e.target.value)}
                  class='w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
                />
              </div>
            </div>

            {/* Error state */}
            <Show when={error()}>
              <div class='p-3 bg-red-50 text-sm text-red-700'>{error()}</div>
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
                  <div class='text-center py-6 text-gray-500'>
                    <FiFile class='w-8 h-8 text-gray-300 mx-auto mb-2' />
                    <p class='text-sm'>
                      {searchQuery() ?
                        'No PDFs found matching your search.'
                      : 'No PDFs found in your Google Drive.'}
                    </p>
                  </div>
                }
              >
                <div class='max-h-60 overflow-y-auto divide-y divide-gray-100'>
                  <For each={files()}>
                    {file => {
                      const selected = () => isFileSelected(file.id);
                      return (
                        <button
                          type='button'
                          onClick={() => props.onToggleFile(file)}
                          class={`w-full flex items-center gap-3 p-2.5 text-left hover:bg-gray-50 transition-colors ${
                            selected() ? 'bg-blue-50 hover:bg-blue-100' : ''
                          }`}
                        >
                          <div
                            class={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                              selected() ?
                                'bg-blue-600 border-blue-600'
                              : 'border-gray-300 bg-white'
                            }`}
                          >
                            <Show when={selected()}>
                              <FiCheck class='w-3 h-3 text-white' />
                            </Show>
                          </div>
                          <FiFile class='w-5 h-5 text-red-500 shrink-0' />
                          <div class='flex-1 min-w-0'>
                            <p class='text-sm font-medium text-gray-900 truncate'>{file.name}</p>
                            <p class='text-xs text-gray-500'>
                              {formatFileSize(file.size)} - {formatDate(file.modifiedTime)}
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
                        </button>
                      );
                    }}
                  </For>
                </div>

                {/* Load more button */}
                <Show when={nextPageToken()}>
                  <div class='text-center py-2 border-t border-gray-100'>
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

            {/* Close browser button */}
            <div class='p-2 border-t border-gray-200 bg-gray-50'>
              <button
                type='button'
                onClick={() => setShowBrowser(false)}
                class='w-full text-sm text-gray-600 hover:text-gray-800 py-1'
              >
                Close browser
              </button>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
