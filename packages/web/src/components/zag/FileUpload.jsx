import * as fileUpload from '@zag-js/file-upload';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createUniqueId, createMemo, Index, Show, mergeProps } from 'solid-js';
import { BiRegularCloudUpload, BiRegularTrash } from 'solid-icons/bi';
import { CgFileDocument } from 'solid-icons/cg';

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
    },
    props,
  );

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

  return (
    <div {...api().getRootProps()} class={merged.class}>
      <Show
        when={!merged.compact}
        fallback={
          // Compact mode - minimal dropzone
          <div
            {...api().getDropzoneProps()}
            class={`border-2 border-dashed rounded-lg py-8 px-4 text-center cursor-pointer transition-colors ${
              api().isDragging ?
                'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            } ${merged.dropzoneClass || ''}`}
          >
            <input {...api().getHiddenInputProps()} />
            <BiRegularCloudUpload class='w-8 h-8 mx-auto text-gray-400 mb-2' />
            <p class='text-sm text-gray-600'>
              <span class='font-medium text-blue-600'>Click to upload</span> or drag and drop
            </p>
            <Show when={merged.helpText}>
              <p class='text-xs text-gray-500 mt-1'>{merged.helpText}</p>
            </Show>
          </div>
        }
      >
        {/* Standard mode - full dropzone with icon */}
        <div
          {...api().getDropzoneProps()}
          class={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            api().isDragging ?
              'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          } ${merged.dropzoneClass || ''}`}
        >
          <input {...api().getHiddenInputProps()} />
          <BiRegularCloudUpload class='w-10 h-10 mx-auto text-gray-400 mb-2' />
          <p class='text-sm text-gray-600'>
            <span class='font-medium text-blue-600'>Click to upload</span> or drag and drop
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
