/**
 * Local checklist row in the sidebar (device-only appraisals)
 */

import { useNavigate } from '@tanstack/react-router';
import { FileCheck2Icon, TrashIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { navRowClass } from '../navStyles';
import { MarqueeLabel } from './MarqueeLabel';

interface LocalChecklistItemProps {
  checklist: { id: string; name?: string };
  isSelected: boolean;
  onDelete: (e: React.MouseEvent, id: string) => void;
}

export function LocalChecklistItem({ checklist, isSelected, onDelete }: LocalChecklistItemProps) {
  const navigate = useNavigate();

  return (
    <div className={`group cursor-pointer pr-1 ${navRowClass(isSelected)}`}>
      <button
        onClick={() => navigate({ to: `/checklist/${checklist.id}` as string })}
        className='flex min-w-0 flex-1 items-center gap-2.5 text-left focus:outline-none'
      >
        <FileCheck2Icon className='size-4 shrink-0' />
        <MarqueeLabel text={checklist.name || 'Untitled Checklist'} className='flex-1' />
      </button>
      <Button
        variant='ghost'
        size='icon-xs'
        onClick={e => onDelete(e, checklist.id)}
        className='text-muted-foreground/70 hover:bg-destructive/5 hover:text-destructive -my-1 opacity-0 group-hover:opacity-100 focus:opacity-100'
        aria-label='Delete checklist'
      >
        <TrashIcon className='size-3.5' />
      </Button>
    </div>
  );
}
