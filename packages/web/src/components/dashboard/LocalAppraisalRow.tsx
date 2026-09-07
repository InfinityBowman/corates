/**
 * LocalAppraisalRow - one device-local checklist. The row opens it; the name
 * itself is click-to-rename, as before.
 */

import {
  FileCheck2Icon,
  ChevronRightIcon,
  Trash2Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InlineEdit } from '@/components/ui/inline-edit';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getChecklistMetadata } from '@/checklist-registry';
import { rowClass } from './DashboardSection';
import { formatRelativeTime } from './utils';

interface LocalAppraisalRowProps {
  checklist: {
    id: string;
    name?: string;
    type?: string;
    updatedAt?: number;
    createdAt?: number;
  };
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (name: string) => void;
  onExportCsv: (id: string) => void;
  onExportPdf: (id: string) => void;
}

export function LocalAppraisalRow({
  checklist,
  onOpen,
  onDelete,
  onRename,
  onExportCsv,
  onExportPdf,
}: LocalAppraisalRowProps) {
  const metadata = getChecklistMetadata(checklist.type || '') as { name?: string } | undefined;
  const typeLabel = metadata?.name || checklist.type || 'Checklist';

  function handleRowClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('button, input, [role="menu"]')) return;
    onOpen(checklist.id);
  }

  return (
    <div className={rowClass()} onClick={handleRowClick}>
      <FileCheck2Icon className='text-muted-foreground size-4 shrink-0' aria-hidden='true' />
      <div className='min-w-0 flex-1'>
        <InlineEdit
          className='text-foreground truncate font-medium'
          value={checklist.name || 'Untitled'}
          showEditIcon
          ariaLabel='Rename checklist'
          onCommit={onRename}
        />
      </div>
      <span className='bg-secondary text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-xs font-medium'>
        {typeLabel}
      </span>
      <span className='text-muted-foreground w-14 shrink-0 text-right text-xs'>
        {formatRelativeTime(checklist.updatedAt || checklist.createdAt)}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='icon-xs'
            className='text-muted-foreground'
            aria-label='Export'
          >
            <DownloadIcon className='size-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem onClick={() => onExportCsv(checklist.id)}>
            <FileSpreadsheetIcon />
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExportPdf(checklist.id)}>
            <FileIcon />
            Export as PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant='ghost'
        size='icon-xs'
        onClick={() => onDelete(checklist.id)}
        className='text-muted-foreground hover:text-destructive'
        aria-label='Delete appraisal'
      >
        <Trash2Icon className='size-4' />
      </Button>
      <ChevronRightIcon className='text-muted-foreground/50 size-4 shrink-0' aria-hidden='true' />
    </div>
  );
}
