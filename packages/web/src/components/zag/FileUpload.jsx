import * as fileUpload from '@zag-js/file-upload';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createUniqueId, createMemo, Index, Show, mergeProps } from 'solid-js';
import { BiRegularCloudUpload, BiRegularTrash } from 'solid-icons/bi';
import { CgFileDocument } from 'solid-icons/cg';
import { useWindowDrag } from '@primitives/useWindowDrag.js';

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

  const service = useMachine(fileUpload.machine, {
    id: createUniqueId(),
    accept: merged.accept ? { [merged.accept]: [] } : undefined,
    // maxFiles > 1 enables the native multi-select file picker (Cmd+click)
    // Setting to a high number allows unlimited files when multiple is true
    maxFiles: merged.multiple ? 100 : 1,
    disabled: merged.disabled,
    onFileChange: details => {
      merged.onFilesChange?.(details.acceptedFiles);
      // When showFileList is false, parent manages files externally
      // Clear internal state so deleted files don't reappear on next selection
      if (!merged.showFileList && details.acceptedFiles.length > 0) {
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
      console.log('Directory drop: found', allFiles.length, 'files');

      if (allFiles.length === 0) return;

      // Filter files based on accept prop if specified
      let filteredFiles = allFiles;
      if (merged.accept) {
        const acceptPatterns = merged.accept.split(',').map(p => p.trim().toLowerCase());
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

      console.log('After filtering:', filteredFiles.length, 'files match accept criteria');

      if (filteredFiles.length > 0) {
        // Directly call the callback since we're bypassing Zag's internal handling
        merged.onFilesChange?.(filteredFiles);
        merged.onFileAccept?.({ files: filteredFiles });
      }
    } catch (error) {
      console.error('Error processing dropped files:', error);
    }
  };

  // Create enhanced dropzone props that add our directory handler
  const getEnhancedDropzoneProps = () => {
    const zagProps = api().getDropzoneProps();

    // Always use our custom handler for drops to support directories
    return {
      ...zagProps,
      onDrop: handleDrop,
      onDragOver: e => {
        e.preventDefault();
        zagProps.onDragOver?.(e);
      },
    };
  };

  return (
    <div {...api().getRootProps()} class={merged.class}>
      <Show
        when={!merged.compact}
        fallback={
          // Compact mode - minimal dropzone
          <div
            {...getEnhancedDropzoneProps()}
            class={`border-2 border-dashed rounded-lg py-8 px-4 text-center cursor-pointer transition-all duration-200 ${
              api().isDragging ? 'border-blue-500 bg-blue-50 scale-[1.02]'
              : isHighlighted() ?
                'border-blue-400 bg-blue-50/50 scale-[1.01] ring-4 ring-blue-100 animate-pulse'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            } ${merged.dropzoneClass || ''}`}
          >
            <input {...api().getHiddenInputProps()} />
            <BiRegularCloudUpload
              class={`w-8 h-8 mx-auto mb-2 transition-all duration-200 ${
                isHighlighted() ? 'text-blue-500 scale-110' : 'text-gray-400'
              }`}
            />
            <p class='text-sm text-gray-600'>
              <span class='font-medium text-blue-600'>
                {isHighlighted() ? 'Drop files here' : 'Click to upload'}
              </span>
              {!isHighlighted() && ' or drag and drop'}
            </p>
            <Show when={merged.helpText}>
              <p class='text-xs text-gray-500 mt-1'>{merged.helpText}</p>
            </Show>
          </div>
        }
      >
        {/* Standard mode - full dropzone with icon */}
        <div
          {...getEnhancedDropzoneProps()}
          class={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200 ${
            api().isDragging ? 'border-blue-500 bg-blue-50 scale-[1.02]'
            : isHighlighted() ?
              'border-blue-400 bg-blue-50/50 scale-[1.01] ring-4 ring-blue-100 animate-pulse'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          } ${merged.dropzoneClass || ''}`}
        >
          <input {...api().getHiddenInputProps()} />
          <BiRegularCloudUpload
            class={`w-10 h-10 mx-auto mb-2 transition-all duration-200 ${
              isHighlighted() ? 'text-blue-500 scale-110' : 'text-gray-400'
            }`}
          />
          <p class='text-sm text-gray-600'>
            <span class='font-medium text-blue-600'>
              {isHighlighted() ? 'Drop files here' : 'Click to upload'}
            </span>
            {!isHighlighted() && ' or drag and drop'}
          </p>
          <Show when={merged.helpText}>
            <p class='text-xs text-gray-500 mt-1'>{merged.helpText}</p>
          </Show>
        </div>
      </Show>

      {/* File list */}
      <Show when={merged.showFileList && api().acceptedFiles.length > 0}>
        <ul {...api().getItemGroupProps()} class='mt-4 space-y-2'>
          <Index each={api().acceptedFiles}>
            {file => (
              <li
                {...api().getItemProps({ file: file() })}
                class='flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200'
              >
                <CgFileDocument class='w-5 h-5 text-red-500 shrink-0' />
                <div class='flex-1 min-w-0'>
                  <div
                    {...api().getItemNameProps({ file: file() })}
                    class='text-sm font-medium text-gray-900 truncate'
                  >
                    {file().name}
                  </div>
                  <p class='text-xs text-gray-500'>{(file().size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button
                  {...api().getItemDeleteTriggerProps({ file: file() })}
                  class='p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors'
                >
                  <BiRegularTrash class='w-4 h-4' />
                </button>
              </li>
            )}
          </Index>
        </ul>
      </Show>
    </div>
  );
}
