/**
 * FileUpload component for file selection with drag-and-drop support (@ark-ui/react)
 *
 * @example
 * <FileUpload accept={["application/pdf"]} maxFiles={5} onFileAccept={(details) => handleFiles(details.files)}>
 *   <FileUploadDropzone>
 *     <p>Click to upload or drag and drop</p>
 *   </FileUploadDropzone>
 *   <FileUploadHiddenInput />
 * </FileUpload>
 */

import * as React from 'react';
import { FileUpload as FileUploadPrimitive } from '@ark-ui/react/file-upload';
import { XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const FileUploadContext = FileUploadPrimitive.Context;
const FileUploadHiddenInput = FileUploadPrimitive.HiddenInput;
const FileUploadClearTrigger = FileUploadPrimitive.ClearTrigger;
const FileUploadItemPreviewImage = FileUploadPrimitive.ItemPreviewImage;

function FileUpload({
  className,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.Root>) {
  return <FileUploadPrimitive.Root className={cn('w-full', className)} {...props} />;
}

function FileUploadDropzone({
  className,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.Dropzone>) {
  return (
    <FileUploadPrimitive.Dropzone
      className={cn(
        'border-border bg-muted/50 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
        'hover:border-primary hover:bg-primary/5',
        'data-dragging:border-primary data-dragging:bg-primary/5',
        className,
      )}
      {...props}
    />
  );
}

function FileUploadTrigger({
  className,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.Trigger>) {
  return (
    <FileUploadPrimitive.Trigger
      className={cn(
        'bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
        'hover:bg-primary/90 focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

function FileUploadLabel({
  className,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.Label>) {
  return (
    <FileUploadPrimitive.Label
      className={cn('text-muted-foreground mb-2 block text-sm font-medium', className)}
      {...props}
    />
  );
}

function FileUploadItemGroup({
  className,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.ItemGroup>) {
  return <FileUploadPrimitive.ItemGroup className={cn('mt-4 space-y-2', className)} {...props} />;
}

function FileUploadItem({
  className,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.Item>) {
  return (
    <FileUploadPrimitive.Item
      className={cn(
        'border-border bg-card flex items-center gap-3 rounded-lg border p-3',
        className,
      )}
      {...props}
    />
  );
}

function FileUploadItemName({
  className,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.ItemName>) {
  return (
    <FileUploadPrimitive.ItemName
      className={cn('text-foreground min-w-0 flex-1 truncate text-sm font-medium', className)}
      {...props}
    />
  );
}

function FileUploadItemSizeText({
  className,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.ItemSizeText>) {
  return (
    <FileUploadPrimitive.ItemSizeText
      className={cn('text-muted-foreground text-xs', className)}
      {...props}
    />
  );
}

function FileUploadItemDeleteTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.ItemDeleteTrigger>) {
  return (
    <FileUploadPrimitive.ItemDeleteTrigger
      className={cn(
        'text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded p-1 transition-colors',
        className,
      )}
      {...props}
    >
      {children ?? <XIcon className='h-4 w-4' />}
    </FileUploadPrimitive.ItemDeleteTrigger>
  );
}

function FileUploadItemPreview({
  className,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.ItemPreview>) {
  return (
    <FileUploadPrimitive.ItemPreview
      className={cn('bg-muted flex h-10 w-10 items-center justify-center rounded', className)}
      {...props}
    />
  );
}

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
