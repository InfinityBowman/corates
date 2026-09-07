/**
 * QuickActions - compact checklist tiles for starting a first local appraisal
 */

import { useNavigate } from '@tanstack/react-router';
import { CHECKLIST_QUICK_STARTS } from './checklistTypes';

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className='grid gap-2 sm:grid-cols-3'>
      {CHECKLIST_QUICK_STARTS.map(item => (
        <button
          key={item.type}
          type='button'
          onClick={() => navigate({ to: '/checklist' as string, search: { type: item.type } })}
          className='border-border bg-card hover:bg-muted/50 hover:border-foreground/20 flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors'
        >
          <span className={`size-2 shrink-0 rounded-full ${item.dotClass}`} aria-hidden='true' />
          <span className='min-w-0'>
            <span className='text-foreground block text-sm font-medium'>{item.name}</span>
            <span className='text-muted-foreground block text-xs'>{item.description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
