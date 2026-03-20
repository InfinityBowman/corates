/**
 * LocalAppraisalCard - Compact horizontal card for local checklists
 */

import { useMemo } from 'react';
import { FileTextIcon, ChevronRightIcon, TrashIcon } from 'lucide-react';
import { SimpleEditable } from '@/components/ui/editable';
import { getChecklistMetadata } from '@/checklist-registry';
import { formatRelativeTime } from './utils';

/* eslint-disable no-unused-vars */
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
  style?: React.CSSProperties;
}
/* eslint-enable no-unused-vars */

export function LocalAppraisalCard({
  checklist,
  onOpen,
  onDelete,
  onRename,
  style,
}: LocalAppraisalCardProps) {
  const typeLabel = useMemo(() => {
    const metadata = getChecklistMetadata(checklist.type || checklist.checklistType || '');
    return (metadata as { name?: string })?.name || checklist.type || 'Checklist';
  }, [checklist.type, checklist.checklistType]);

  const relativeTime = formatRelativeTime(checklist.updatedAt || checklist.createdAt);

  return (
    <div
      className='group border-border/60 bg-card hover:border-border flex items-center gap-4 rounded-xl border p-4 transition-all duration-200 hover:shadow-md'
      style={style}
    >
      {/* Icon */}
      <div className='bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors'>
        <FileTextIcon className='size-5' />
      </div>

      {/* Content */}
      <div className='min-w-0 flex-1'>
        {onRename ?
          <SimpleEditable
            activationMode='click'
            variant='inline'
            className='text-foreground truncate text-sm font-medium'
            value={checklist.name || 'Untitled'}
            showEditIcon
            onSubmit={newName => onRename(newName)}
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
        {onDelete && (
          <button
            type='button'
            onClick={e => {
              e.stopPropagation();
              onDelete(checklist.id);
            }}
            className='text-muted-foreground/50 rounded-lg p-2 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500'
            title='Delete appraisal'
          >
            <TrashIcon className='size-4' />
          </button>
        )}
        <button
          type='button'
          onClick={() => onOpen(checklist.id)}
          className='text-primary hover:bg-primary/5 hover:text-primary/80 flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-all'
          title='Open appraisal'
        >
          Open
          <ChevronRightIcon className='size-4 transition-transform group-hover:translate-x-0.5' />
        </button>
      </div>
    </div>
  );
}
