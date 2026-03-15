/**
 * PdfListItem - Single PDF row with view, download, tag, delete actions
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Trash2Icon,
  EyeIcon,
  DownloadIcon,
  PencilIcon,
  FileIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PdfTagBadge } from './PdfTagBadge';

/* eslint-disable no-unused-vars */
interface PdfListItemProps {
  pdf: any;
  onView?: (pdf: any) => void;
  onDownload?: (pdf: any) => void;
  onDelete?: (pdf: any) => void;
  onTagChange?: (pdfId: string, newTag: string) => void;
  onEditMetadata?: (pdf: any) => void;
  readOnly?: boolean;
  hasPrimary?: boolean;
  hasProtocol?: boolean;
}

function formatFileSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PdfListItem({
  pdf,
  onView,
  onDownload,
  onDelete,
  onTagChange,
  onEditMetadata,
  readOnly,
  hasPrimary,
  hasProtocol,
}: PdfListItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const tagMenuItems = useMemo(() => {
    const items: Array<{ value: string; label: string }> = [];
    if (pdf.tag !== 'primary') {
      items.push({
        value: 'primary',
        label: hasPrimary ? 'Set as Primary (replaces current)' : 'Set as Primary',
      });
    }
    if (pdf.tag !== 'protocol') {
      items.push({
        value: 'protocol',
        label: hasProtocol ? 'Set as Protocol (replaces current)' : 'Set as Protocol',
      });
    }
    if (pdf.tag !== 'secondary') {
      items.push({ value: 'secondary', label: 'Set as Secondary' });
    }
    return items;
  }, [pdf.tag, hasPrimary, hasProtocol]);

  const handleDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    onDelete?.(pdf);
  }, [onDelete, pdf]);

  return (
    <>
      <div className="border-border bg-card flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-border">
        <div className="shrink-0">
          <FileIcon className="text-muted-foreground h-8 w-8" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-foreground truncate text-sm font-medium">{pdf.fileName}</span>
            <PdfTagBadge tag={pdf.tag} />
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {formatFileSize(pdf.size)}
            {pdf.uploadedAt && <> &middot; {new Date(pdf.uploadedAt).toLocaleDateString()}</>}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onView?.(pdf)}
            className="text-muted-foreground hover:bg-primary/5 hover:text-primary rounded-md p-2 transition-colors"
            title="View PDF"
          >
            <EyeIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onDownload?.(pdf)}
            className="text-muted-foreground hover:bg-primary/5 hover:text-primary rounded-md p-2 transition-colors"
            title="Download PDF"
          >
            <DownloadIcon className="h-4 w-4" />
          </button>

          {!readOnly && (
            <>
              <button
                type="button"
                onClick={() => onEditMetadata?.(pdf)}
                className="text-muted-foreground hover:bg-primary/5 hover:text-primary rounded-md p-2 transition-colors"
                title="Edit Metadata"
              >
                <PencilIcon className="h-4 w-4" />
              </button>

              {tagMenuItems.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="text-muted-foreground hover:bg-primary/5 hover:text-primary rounded-md px-2 py-1 text-xs transition-colors">
                    Tag
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {tagMenuItems.map(item => (
                      <DropdownMenuItem
                        key={item.value}
                        onClick={() => onTagChange?.(pdf.id, item.value)}
                      >
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-muted-foreground hover:bg-destructive/5 hover:text-destructive rounded-md p-2 transition-colors"
                title="Delete PDF"
              >
                <Trash2Icon className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete PDF</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{pdf.fileName}</strong>? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
