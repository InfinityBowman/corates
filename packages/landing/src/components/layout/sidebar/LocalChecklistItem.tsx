/**
 * Local checklist item in sidebar (offline practice checklists)
 */

import { useNavigate } from '@tanstack/react-router';
import { FileCheck2Icon, TrashIcon } from 'lucide-react';

/* eslint-disable no-unused-vars */
interface LocalChecklistItemProps {
  checklist: { id: string; name?: string; updatedAt?: number; createdAt?: number };
  isSelected: boolean;
  onDelete: (e: React.MouseEvent, id: string) => void;
}
/* eslint-enable no-unused-vars */

function formatDate(timestamp?: number): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString();
}

export function LocalChecklistItem({ checklist, isSelected, onDelete }: LocalChecklistItemProps) {
  const navigate = useNavigate();

  return (
    <div
      className={`group flex items-center rounded-lg transition-colors ${
        isSelected ? 'bg-primary/10 text-primary' : 'text-secondary-foreground hover:bg-muted'
      }`}
    >
      <button
        onClick={() => navigate({ to: `/checklist/${checklist.id}` as string })}
        className='flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left focus:outline-none'
      >
        <FileCheck2Icon className='text-muted-foreground size-4 shrink-0' />
        <div className='min-w-0 flex-1'>
          <div className='truncate text-sm font-medium'>
            {checklist.name || 'Untitled Checklist'}
          </div>
          <div className='text-2xs text-muted-foreground mt-0.5'>
            {formatDate(checklist.updatedAt || checklist.createdAt)}
          </div>
        </div>
      </button>
      <button
        onClick={e => onDelete(e, checklist.id)}
        className='text-muted-foreground/70 focus:ring-primary mr-1 rounded p-1.5 opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus:opacity-100 focus:ring-2 focus:outline-none'
        aria-label='Delete checklist'
      >
        <TrashIcon className='size-4' />
      </button>
    </div>
  );
}
