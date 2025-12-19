import * as fileUpload from '@zag-js/file-upload';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createUniqueId, createMemo, Index, Show, mergeProps } from 'solid-js';
import { BiRegularCloudUpload, BiRegularTrash } from 'solid-icons/bi';
import { CgFileDocument } from 'solid-icons/cg';
import { useWindowDrag } from '../primitives/useWindowDrag.js';

/**
 * Recursively read all files from a directory entry
 * @param {FileSystemDirectoryEntry} dirEntry
 * @returns {Promise<File[]>}
 */
async function readDirectoryRecursively(dirEntry) {
  const files = [];
  const reader = dirEntry.createReader();

  // readEntries may not return all entries at once, so we need to call it repeatedly
  const readEntries = () => {
    return new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
  };

  let entries = await readEntries();
  while (entries.length > 0) {
    for (const entry of entries) {
      if (entry.isFile) {
        const file = await new Promise((resolve, reject) => {
          entry.file(resolve, reject);
        });
        files.push(file);
      } else if (entry.isDirectory) {
        const subFiles = await readDirectoryRecursively(entry);
        files.push(...subFiles);
      }
    }
    entries = await readEntries();
  }

  return files;
}

/**
 * Extract all files from a drop event, including files nested in directories
 * @param {DataTransfer} dataTransfer
 * @returns {Promise<File[]>}
 */
async function getFilesFromDrop(dataTransfer) {
  const files = [];
  const items = dataTransfer.items;

  if (!items) {
    // Fallback for browsers that don't support DataTransferItemList
    return Array.from(dataTransfer.files);
  }

  const entries = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // webkitGetAsEntry is the standard way to get directory access
    const entry = item.webkitGetAsEntry?.();
    if (entry) {
      entries.push(entry);
    }
  }

  for (const entry of entries) {
    if (entry.isFile) {
      const file = await new Promise((resolve, reject) => {
        entry.file(resolve, reject);
      });
      files.push(file);
    } else if (entry.isDirectory) {
      const dirFiles = await readDirectoryRecursively(entry);
      files.push(...dirFiles);
    }
  }

  return files;
}

/**
 * FileUpload - Reusable file upload component using Zag.js
 *
 * @param {Object} props
 * @param {string} [props.accept] - Accepted file types (e.g., 'application/pdf')
 * @param {boolean} [props.multiple] - Allow multiple file selection (default: false)
 * @param {Function} [props.onFilesChange] - Callback when files change: (files: File[]) => void
 * @param {Function} [props.onFileAccept] - Callback when files are accepted: (details: { files: File[] }) => void
 * @param {string} [props.dropzoneText] - Custom text for the dropzone
 * @param {string} [props.buttonText] - Custom text for the trigger button
 * @param {string} [props.helpText] - Helper text below the dropzone text
 * @param {boolean} [props.showFileList] - Whether to show the list of uploaded files (default: true)
 * @param {string} [props.class] - Additional CSS classes for the root element
 * @param {string} [props.dropzoneClass] - Additional CSS classes for the dropzone
 * @param {boolean} [props.disabled] - Disable the file upload
 * @param {boolean} [props.compact] - Use compact/minimal styling
 * @param {boolean} [props.allowDirectories] - Allow dropping directories (default: true for multiple)
 */
export function FileUpload(props) {
  const merged = mergeProps(
    {
      multiple: false,
      showFileList: true,
      dropzoneText: 'Drag your file(s) here',
      buttonText: 'Choose file(s)',
      helpText: '',
      compact: false,
      allowDirectories: undefined, // Will default to true if multiple is true
    },
    props,
  );

  // Allow directories by default when multiple files are allowed
  const allowDirs = () => merged.allowDirectories ?? merged.multiple;
  const showFileList = () => merged.showFileList;
  const accept = () => merged.accept;
  const classValue = () => merged.class;
  const compact = () => merged.compact;
  const dropzoneClass = () => merged.dropzoneClass;
  const helpText = () => merged.helpText;

  const service = useMachine(fileUpload.machine, {
    id: createUniqueId(),
    // eslint-disable-next-line solid/reactivity
    accept: merged.accept ? { [merged.accept]: [] } : undefined,
    // maxFiles > 1 enables the native multi-select file picker (Cmd+click)
    // Setting to a high number allows unlimited files when multiple is true
    // eslint-disable-next-line solid/reactivity
    maxFiles: merged.multiple ? 100 : 1,
    // eslint-disable-next-line solid/reactivity
    disabled: merged.disabled,
    onFileChange: details => {
      merged.onFilesChange?.(details.acceptedFiles);
      // When showFileList is false, parent manages files externally
      // Clear internal state so deleted files don't reappear on next selection
      if (!showFileList() && details.acceptedFiles.length > 0) {
        // Use queueMicrotask to clear after the callback completes
        queueMicrotask(() => {
          const currentApi = fileUpload.connect(service, normalizeProps);
          currentApi.clearFiles();
        });
      }
    },
    onFileAccept: details => {
      merged.onFileAccept?.(details);
    },
  });

  const api = createMemo(() => fileUpload.connect(service, normalizeProps));

  // Detect when files are being dragged over the window (even from external sources like Finder)
  const { isDraggingOverWindow } = useWindowDrag();

  // Combine internal isDragging with window-level drag detection
  const isHighlighted = () => api().isDragging || isDraggingOverWindow();

  // Custom drop handler to support directory drops
  const handleDrop = async e => {
    e.preventDefault();
    e.stopPropagation();

    // Check if this is a directory drop by looking for webkitGetAsEntry
    const items = e.dataTransfer?.items;
    const hasDirectories =
      items &&
      Array.from(items).some(item => {
        const entry = item.webkitGetAsEntry?.();
        return entry?.isDirectory;
      });

    // If no directories and allowDirs is false, let normal handling occur
    if (!hasDirectories && !allowDirs()) {
      return;
    }

    try {
      const allFiles = await getFilesFromDrop(e.dataTransfer);

      if (allFiles.length === 0) return;

      // Filter files based on accept prop if specified
      let filteredFiles = allFiles;
      if (accept()) {
        const acceptPatterns = accept()
          .split(',')
          .map(p => p.trim().toLowerCase());
        filteredFiles = allFiles.filter(file => {
          const ext = '.' + file.name.split('.').pop().toLowerCase();
          const mimeType = (file.type || '').toLowerCase();
          return acceptPatterns.some(pattern => {
            if (pattern.startsWith('.')) {
              return ext === pattern;
            }
            if (pattern.includes('*')) {
              const [type] = pattern.split('/');
              return mimeType.startsWith(type + '/');
            }
            return mimeType === pattern || pattern === ext;
          });
        });
      }

      // Call the callback with filtered files
      if (filteredFiles.length > 0) {
        merged.onFilesChange?.(filteredFiles);
        merged.onFileAccept?.({ files: filteredFiles });
      }
    } catch (err) {
      // Fall back to normal handling if directory reading fails
      console.error('Error reading dropped items:', err);
    }
  };

  // Format file size for display
  const formatFileSize = bytes => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div {...api().getRootProps()} class={classValue()}>
      <div
        {...api().getDropzoneProps()}
        onDrop={handleDrop}
        class={`rounded-lg border-2 border-dashed transition-all duration-200 ${isHighlighted() ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'} ${compact() ? 'p-4' : 'p-8'} ${dropzoneClass() || ''} `}
      >
        <input {...api().getHiddenInputProps()} />
        <div class='flex flex-col items-center justify-center gap-2 text-center'>
          <BiRegularCloudUpload
            class={`text-gray-400 ${compact() ? 'h-8 w-8' : 'h-12 w-12'} ${isHighlighted() ? 'text-blue-500' : ''}`}
          />
          <div class={compact() ? 'text-sm' : ''}>
            <p class='font-medium text-gray-700'>{merged.dropzoneText}</p>
            <Show when={helpText()}>
              <p class='mt-1 text-xs text-gray-500'>{helpText()}</p>
            </Show>
          </div>
          <span class='text-sm text-gray-400'>or</span>
          <button
            {...api().getTriggerProps()}
            class={`rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none ${compact() ? 'px-3 py-1.5 text-sm' : ''} `}
          >
            {merged.buttonText}
          </button>
        </div>
      </div>

      <Show when={showFileList() && api().acceptedFiles.length > 0}>
        <ul class='mt-4 space-y-2'>
          <Index each={api().acceptedFiles}>
            {file => (
              <li
                {...api().getItemProps({ file: file() })}
                class='flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3'
              >
                <CgFileDocument class='h-8 w-8 shrink-0 text-gray-400' />
                <div class='min-w-0 flex-1'>
                  <p
                    {...api().getItemNameProps({ file: file() })}
                    class='truncate text-sm font-medium text-gray-900'
                  >
                    {file().name}
                  </p>
                  <p class='text-xs text-gray-500'>{formatFileSize(file().size)}</p>
                </div>
                <button
                  {...api().getItemDeleteTriggerProps({ file: file() })}
                  class='rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500'
                  title='Remove file'
                >
                  <BiRegularTrash class='h-4 w-4' />
                </button>
              </li>
            )}
          </Index>
        </ul>
      </Show>
    </div>
  );
}

export default FileUpload;
