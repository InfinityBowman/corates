/**
 * LocalAppraisalCard - Compact horizontal card for local checklists
 */

import { useMemo } from 'react';
import {
  FileTextIcon,
  ChevronRightIcon,
  Trash2Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { InlineEdit } from '@/components/ui/inline-edit';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getChecklistMetadata } from '@/checklist-registry';
import { formatRelativeTime } from './utils';

interface LocalAppraisalCardProps {
  checklist: {
    id: string;
    name?: string;
    type?: string;
    checklistType?: string;
    updatedAt?: number;
    createdAt?: number;
  };
  onOpen: (id: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (name: string) => void;
  onExportCsv?: (id: string) => void;
  onExportPdf?: (id: string) => void;
  style?: React.CSSProperties;
}

export function LocalAppraisalCard({
  checklist,
  onOpen,
  onDelete,
  onRename,
  onExportCsv,
  onExportPdf,
  style,
}: LocalAppraisalCardProps) {
  const typeLabel = useMemo(() => {
    const metadata = getChecklistMetadata(checklist.type || checklist.checklistType || '');
    return (metadata as { name?: string })?.name || checklist.type || 'Checklist';
  }, [checklist.type, checklist.checklistType]);

  const relativeTime = formatRelativeTime(checklist.updatedAt || checklist.createdAt);

  return (
    <Card
      className='group border-border/60 hover:border-border flex flex-row items-center gap-4 p-4 transition-all duration-200 hover:shadow-md'
      style={style}
    >
      <CardContent className='flex min-w-0 flex-1 items-center gap-4 p-0'>
        {/* Icon */}
        <div className='bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors'>
          <FileTextIcon className='size-5' />
        </div>

        {/* Content */}
        <div className='min-w-0 flex-1'>
          {onRename ?
            <InlineEdit
              className='text-foreground truncate text-sm font-medium'
              value={checklist.name || 'Untitled'}
              showEditIcon
              ariaLabel='Rename checklist'
              onCommit={newName => onRename(newName)}
            />
          : <h4 className='text-foreground truncate text-sm font-medium'>{checklist.name}</h4>}
          <div className='text-muted-foreground/70 mt-0.5 flex items-center gap-2 text-xs'>
            <span className='bg-secondary text-muted-foreground rounded px-1.5 py-0.5 font-medium'>
              {typeLabel}
            </span>
            <span>{relativeTime}</span>
          </div>
        </div>

        {/* Actions */}
        <div className='flex shrink-0 items-center gap-1'>
          {(onExportCsv || onExportPdf) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  onClick={e => e.stopPropagation()}
                  className='text-muted-foreground'
                  title='Export'
                  aria-label='Export'
                >
                  <DownloadIcon className='size-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                {onExportCsv && (
                  <DropdownMenuItem onClick={() => onExportCsv(checklist.id)}>
                    <FileSpreadsheetIcon />
                    Export as CSV
                  </DropdownMenuItem>
                )}
                {onExportPdf && (
                  <DropdownMenuItem onClick={() => onExportPdf(checklist.id)}>
                    <FileIcon />
                    Export as PDF
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {onDelete && (
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={e => {
                e.stopPropagation();
                onDelete(checklist.id);
              }}
              className='text-muted-foreground hover:text-destructive'
              title='Delete appraisal'
              aria-label='Delete appraisal'
            >
              <Trash2Icon className='size-4' />
            </Button>
          )}
          <Button
            variant='ghost'
            onClick={() => onOpen(checklist.id)}
            className='text-primary hover:bg-primary/5 hover:text-primary/80'
            title='Open appraisal'
          >
            Open
            <ChevronRightIcon className='size-4 transition-transform group-hover:translate-x-0.5' />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
