/**
 * FileUpload component using Ark UI
 */

import { FileUpload } from '@ark-ui/solid/file-upload';
import { Component, Show, mergeProps, For } from 'solid-js';
import { BiRegularCloudUpload, BiRegularTrash } from 'solid-icons/bi';
import { CgFileDocument } from 'solid-icons/cg';
import { useWindowDrag } from '../primitives/useWindowDrag.js';

export interface FileUploadProps {
  /** Accepted file types (e.g., 'application/pdf') */
  accept?: string;
  /** Allow multiple file selection (default: false) */
  multiple?: boolean;
  /** Callback when files change */
  onFilesChange?: (_files: File[]) => void;
  /** Callback when files are accepted */
  onFileAccept?: (_details: { files: File[] }) => void;
  /** Callback when files are rejected */
  onFileReject?: (_details: { files: unknown[] }) => void;
  /** Custom text for the dropzone */
  dropzoneText?: string;
  /** Custom text for the trigger button */
  buttonText?: string;
  /** Helper text below the dropzone text */
  helpText?: string;
  /** Whether to show the list of uploaded files (default: true) */
  showFileList?: boolean;
  /** Additional CSS classes for the root element */
  class?: string;
  /** Additional CSS classes for the dropzone */
  dropzoneClass?: string;
  /** Disable the file upload */
  disabled?: boolean;
  /** Use compact/minimal styling */
  compact?: boolean;
  /** Allow dropping directories (default: true for multiple) */
  allowDirectories?: boolean;
}

/**
 * FileUpload - Reusable file upload component using Ark UI
 */
const FileUploadComponent: Component<FileUploadProps> = props => {
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
  const acceptValue = () => merged.accept;
  const classValue = () => merged.class;
  const compact = () => merged.compact;
  const dropzoneClass = () => merged.dropzoneClass;
  const helpText = () => merged.helpText;

  // Detect when files are being dragged over the window (even from external sources like Finder)
  const { isDraggingOverWindow } = useWindowDrag();

  const handleFileChange = (details: { acceptedFiles: File[] }) => {
    // Pass files to callback
    merged.onFilesChange?.(details.acceptedFiles);
  };

  const handleFileAccept = (details: { files: File[] }) => {
    merged.onFileAccept?.(details);
  };

  const handleFileReject = (details: { files: unknown[] }) => {
    merged.onFileReject?.(details);
  };

  return (
    <FileUpload.Root
      accept={acceptValue() || undefined}
      maxFiles={merged.multiple ? 100 : 1}
      directory={allowDirs()}
      disabled={merged.disabled}
      acceptedFiles={[]}
      onFileChange={handleFileChange}
      onFileAccept={handleFileAccept}
      onFileReject={handleFileReject}
      class={classValue()}
    >
      <FileUpload.Context>
        {api => {
          const isHighlighted = () => api().dragging || isDraggingOverWindow();

          return (
            <>
              <FileUpload.Dropzone
                class={`rounded-lg border-2 border-dashed transition-all duration-200 ${
                  isHighlighted() ?
                    'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
                } ${compact() ? 'p-4' : 'p-8'} ${dropzoneClass() || ''}`}
              >
                <FileUpload.HiddenInput />
                <div class='flex flex-col items-center justify-center gap-2 text-center'>
                  <BiRegularCloudUpload
                    class={`text-gray-400 ${compact() ? 'h-8 w-8' : 'h-12 w-12'} ${
                      isHighlighted() ? 'text-blue-500' : ''
                    }`}
                  />
                  <div class={compact() ? 'text-sm' : ''}>
                    <p class='font-medium text-gray-700'>{merged.dropzoneText}</p>
                    <Show when={helpText()}>
                      <p class='mt-1 text-xs text-gray-500'>{helpText()}</p>
                    </Show>
                  </div>
                  <span class='text-sm text-gray-400'>or</span>
                  <FileUpload.Trigger
                    class={`rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none ${
                      compact() ? 'px-3 py-1.5 text-sm' : ''
                    }`}
                  >
                    {merged.buttonText}
                  </FileUpload.Trigger>
                </div>
              </FileUpload.Dropzone>

              <Show when={showFileList() && api().acceptedFiles.length > 0}>
                <FileUpload.ItemGroup class='mt-4 space-y-2'>
                  <For each={api().acceptedFiles}>
                    {file => (
                      <FileUpload.Item
                        file={file}
                        class='flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3'
                      >
                        <CgFileDocument class='h-8 w-8 shrink-0 text-gray-400' />
                        <div class='min-w-0 flex-1'>
                          <FileUpload.ItemName class='truncate text-sm font-medium text-gray-900'>
                            {file.name}
                          </FileUpload.ItemName>
                          <FileUpload.ItemSizeText class='text-xs text-gray-500' />
                        </div>
                        <FileUpload.ItemDeleteTrigger
                          class='rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500'
                          title='Remove file'
                        >
                          <BiRegularTrash class='h-4 w-4' />
                        </FileUpload.ItemDeleteTrigger>
                      </FileUpload.Item>
                    )}
                  </For>
                </FileUpload.ItemGroup>
              </Show>
            </>
          );
        }}
      </FileUpload.Context>
    </FileUpload.Root>
  );
};

export { FileUploadComponent as FileUpload };

// Export raw Ark UI primitive for custom layouts
export { FileUpload as FileUploadPrimitive };
