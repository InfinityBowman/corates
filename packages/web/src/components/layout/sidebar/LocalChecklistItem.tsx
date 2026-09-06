/**
 * Local checklist item in sidebar (offline practice checklists)
 */

import { useNavigate } from '@tanstack/react-router';
import { FileCheck2Icon, TrashIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarqueeLabel } from './MarqueeLabel';

interface LocalChecklistItemProps {
  checklist: { id: string; name?: string; updatedAt?: number; createdAt?: number };
  isSelected: boolean;
  onDelete: (e: React.MouseEvent, id: string) => void;
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString();
}

export function LocalChecklistItem({ checklist, isSelected, onDelete }: LocalChecklistItemProps) {
  const navigate = useNavigate();

  return (
    <div
      className={`group flex items-center rounded-md transition-colors ${
        isSelected ?
          'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <button
        onClick={() => navigate({ to: `/checklist/${checklist.id}` as string })}
        className='flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left focus:outline-none'
      >
        <FileCheck2Icon className='size-4 shrink-0' />
        <div className='min-w-0 flex-1'>
          <MarqueeLabel
            text={checklist.name || 'Untitled appraisal'}
            className='text-sm font-medium'
          />
          <div className='text-2xs text-muted-foreground/80 mt-0.5'>
            {formatDate(checklist.updatedAt || checklist.createdAt)}
          </div>
        </div>
      </button>
      <Button
        variant='ghost'
        size='icon-sm'
        onClick={e => onDelete(e, checklist.id)}
        className='text-muted-foreground/70 hover:bg-destructive/5 hover:text-destructive mr-1 opacity-0 group-hover:opacity-100 focus:opacity-100'
        aria-label='Delete appraisal'
      >
        <TrashIcon className='size-4' />
      </Button>
    </div>
  );
}
