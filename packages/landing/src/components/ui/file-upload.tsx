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

import * as React from "react"
import { FileUpload as FileUploadPrimitive } from "@ark-ui/react/file-upload"
import { XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const FileUploadContext = FileUploadPrimitive.Context
const FileUploadHiddenInput = FileUploadPrimitive.HiddenInput
const FileUploadClearTrigger = FileUploadPrimitive.ClearTrigger
const FileUploadItemPreviewImage = FileUploadPrimitive.ItemPreviewImage

function FileUpload({
  className,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.Root>) {
  return <FileUploadPrimitive.Root className={cn("w-full", className)} {...props} />
}

function FileUploadDropzone({
  className,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.Dropzone>) {
  return (
    <FileUploadPrimitive.Dropzone
      className={cn(
        "flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 p-6 transition-colors",
        "hover:border-primary hover:bg-accent",
        "data-dragging:border-primary data-dragging:bg-accent",
        className,
      )}
      {...props}
    />
  )
}

function FileUploadTrigger({
  className,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.Trigger>) {
  return (
    <FileUploadPrimitive.Trigger
      className={cn(
        "inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors",
        "hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

function FileUploadLabel({
  className,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.Label>) {
  return (
    <FileUploadPrimitive.Label
      className={cn("mb-2 block text-sm font-medium text-muted-foreground", className)}
      {...props}
    />
  )
}

function FileUploadItemGroup({
  className,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.ItemGroup>) {
  return (
    <FileUploadPrimitive.ItemGroup className={cn("mt-4 space-y-2", className)} {...props} />
  )
}

function FileUploadItem({
  className,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.Item>) {
  return (
    <FileUploadPrimitive.Item
      className={cn("flex items-center gap-3 rounded-lg border border-border bg-card p-3", className)}
      {...props}
    />
  )
}

function FileUploadItemName({
  className,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.ItemName>) {
  return (
    <FileUploadPrimitive.ItemName
      className={cn("min-w-0 flex-1 truncate text-sm font-medium text-foreground", className)}
      {...props}
    />
  )
}

function FileUploadItemSizeText({
  className,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.ItemSizeText>) {
  return (
    <FileUploadPrimitive.ItemSizeText
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function FileUploadItemDeleteTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.ItemDeleteTrigger>) {
  return (
    <FileUploadPrimitive.ItemDeleteTrigger
      className={cn(
        "rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive",
        className,
      )}
      {...props}
    >
      {children ?? <XIcon className="h-4 w-4" />}
    </FileUploadPrimitive.ItemDeleteTrigger>
  )
}

function FileUploadItemPreview({
  className,
  ...props
}: React.ComponentProps<typeof FileUploadPrimitive.ItemPreview>) {
  return (
    <FileUploadPrimitive.ItemPreview
      className={cn("flex h-10 w-10 items-center justify-center rounded bg-muted", className)}
      {...props}
    />
  )
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
}
