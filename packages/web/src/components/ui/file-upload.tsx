/**
 * FileUpload component for file selection with drag-and-drop support.
 *
 * @example
 * // Basic dropzone
 * <FileUpload
 *   accept={['application/pdf', '.pdf']}
 *   maxFiles={5}
 *   onFileAccept={details => handleFiles(details.files)}
 * >
 *   <FileUploadDropzone>
 *     <FiUploadCloud class="h-8 w-8 text-gray-400" />
 *     <p>Click to upload or drag and drop</p>
 *     <p class="text-xs text-gray-400">PDF files only</p>
 *   </FileUploadDropzone>
 *   <FileUploadHiddenInput />
 * </FileUpload>
 *
 * @example
 * // With file list
 * <FileUpload maxFiles={5} onFileAccept={handleFiles}>
 *   <FileUploadDropzone>Drop files here</FileUploadDropzone>
 *   <FileUploadItemGroup>
 *     <FileUploadContext>
 *       {api => (
 *         <For each={api().acceptedFiles}>
 *           {file => (
 *             <FileUploadItem file={file}>
 *               <FileUploadItemName />
 *               <FileUploadItemSizeText />
 *               <FileUploadItemDeleteTrigger />
 *             </FileUploadItem>
 *           )}
 *         </For>
 *       )}
 *     </FileUploadContext>
 *   </FileUploadItemGroup>
 *   <FileUploadHiddenInput />
 * </FileUpload>
 */
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { FileUpload as FileUploadPrimitive } from '@ark-ui/solid/file-upload';
import type {
  FileUploadRootProps as ArkFileUploadRootProps,
  FileUploadDropzoneProps as ArkFileUploadDropzoneProps,
  FileUploadTriggerProps as ArkFileUploadTriggerProps,
  FileUploadLabelProps as ArkFileUploadLabelProps,
  FileUploadItemGroupProps as ArkFileUploadItemGroupProps,
  FileUploadItemProps as ArkFileUploadItemProps,
  FileUploadItemNameProps as ArkFileUploadItemNameProps,
  FileUploadItemSizeTextProps as ArkFileUploadItemSizeTextProps,
  FileUploadItemDeleteTriggerProps as ArkFileUploadItemDeleteTriggerProps,
  FileUploadItemPreviewProps as ArkFileUploadItemPreviewProps,
} from '@ark-ui/solid/file-upload';
import { FiX } from 'solid-icons/fi';
import { cn } from './cn';

// Re-export context and hidden input directly
const FileUploadContext = FileUploadPrimitive.Context;
const FileUploadHiddenInput = FileUploadPrimitive.HiddenInput;
const FileUploadClearTrigger = FileUploadPrimitive.ClearTrigger;
const FileUploadItemPreviewImage = FileUploadPrimitive.ItemPreviewImage;

type FileUploadProps = ArkFileUploadRootProps & {
  class?: string;
  children?: JSX.Element;
};

const FileUpload: Component<FileUploadProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <FileUploadPrimitive.Root class={cn('w-full', local.class)} {...others}>
      {local.children}
    </FileUploadPrimitive.Root>
  );
};

type FileUploadDropzoneProps = ArkFileUploadDropzoneProps & {
  class?: string;
  children?: JSX.Element;
};

const FileUploadDropzone: Component<FileUploadDropzoneProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <FileUploadPrimitive.Dropzone
      class={cn(
        'flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 transition-colors',
        'hover:border-blue-400 hover:bg-blue-50',
        'data-dragging:border-blue-500 data-dragging:bg-blue-50',
        local.class,
      )}
      {...others}
    >
      {local.children}
    </FileUploadPrimitive.Dropzone>
  );
};

type FileUploadTriggerProps = ArkFileUploadTriggerProps & {
  class?: string;
  children?: JSX.Element;
};

const FileUploadTrigger: Component<FileUploadTriggerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <FileUploadPrimitive.Trigger
      class={cn(
        'inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors',
        'hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        local.class,
      )}
      {...others}
    >
      {local.children}
    </FileUploadPrimitive.Trigger>
  );
};

type FileUploadLabelProps = ArkFileUploadLabelProps & {
  class?: string;
  children?: JSX.Element;
};

const FileUploadLabel: Component<FileUploadLabelProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <FileUploadPrimitive.Label
      class={cn('mb-2 block text-sm font-medium text-gray-700', local.class)}
      {...others}
    >
      {local.children}
    </FileUploadPrimitive.Label>
  );
};

type FileUploadItemGroupProps = ArkFileUploadItemGroupProps & {
  class?: string;
  children?: JSX.Element;
};

const FileUploadItemGroup: Component<FileUploadItemGroupProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <FileUploadPrimitive.ItemGroup class={cn('mt-4 space-y-2', local.class)} {...others}>
      {local.children}
    </FileUploadPrimitive.ItemGroup>
  );
};

type FileUploadItemProps = ArkFileUploadItemProps & {
  class?: string;
  children?: JSX.Element;
};

const FileUploadItem: Component<FileUploadItemProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <FileUploadPrimitive.Item
      class={cn(
        'flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3',
        local.class,
      )}
      {...others}
    >
      {local.children}
    </FileUploadPrimitive.Item>
  );
};

type FileUploadItemNameProps = ArkFileUploadItemNameProps & {
  class?: string;
};

const FileUploadItemName: Component<FileUploadItemNameProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <FileUploadPrimitive.ItemName
      class={cn('min-w-0 flex-1 truncate text-sm font-medium text-gray-900', local.class)}
      {...others}
    />
  );
};

type FileUploadItemSizeTextProps = ArkFileUploadItemSizeTextProps & {
  class?: string;
};

const FileUploadItemSizeText: Component<FileUploadItemSizeTextProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <FileUploadPrimitive.ItemSizeText
      class={cn('text-xs text-gray-500', local.class)}
      {...others}
    />
  );
};

type FileUploadItemDeleteTriggerProps = ArkFileUploadItemDeleteTriggerProps & {
  class?: string;
  children?: JSX.Element;
};

const FileUploadItemDeleteTrigger: Component<FileUploadItemDeleteTriggerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <FileUploadPrimitive.ItemDeleteTrigger
      class={cn(
        'rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600',
        local.class,
      )}
      {...others}
    >
      {local.children ?? <FiX class='h-4 w-4' />}
    </FileUploadPrimitive.ItemDeleteTrigger>
  );
};

type FileUploadItemPreviewProps = ArkFileUploadItemPreviewProps & {
  class?: string;
  children?: JSX.Element;
};

const FileUploadItemPreview: Component<FileUploadItemPreviewProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <FileUploadPrimitive.ItemPreview
      class={cn('flex h-10 w-10 items-center justify-center rounded bg-gray-100', local.class)}
      {...others}
    >
      {local.children}
    </FileUploadPrimitive.ItemPreview>
  );
};

export {
  FileUpload,
  FileUploadDropzone,
  FileUploadTrigger,
  FileUploadLabel,
  FileUploadItemGroup,
  FileUploadItem,
  FileUploadItemName,
  FileUploadItemSizeText,
  FileUploadItemDeleteTrigger,
  FileUploadItemPreview,
  FileUploadItemPreviewImage,
  FileUploadContext,
  FileUploadHiddenInput,
  FileUploadClearTrigger,
};
