/**
 * NewAppraisalMenu - picks a checklist and opens the new local appraisal page
 */

import { useNavigate } from '@tanstack/react-router';
import { ChevronDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CHECKLIST_QUICK_STARTS } from './checklistTypes';

export function NewAppraisalMenu() {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='outline' size='sm'>
          New appraisal
          <ChevronDownIcon data-icon='inline-end' className='text-muted-foreground size-3.5' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-64'>
        {CHECKLIST_QUICK_STARTS.map(item => (
          <DropdownMenuItem
            key={item.type}
            onClick={() => navigate({ to: '/checklist' as string, search: { type: item.type } })}
            className='items-start py-1.5'
          >
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${item.dotClass}`} />
            <span className='flex flex-col'>
              <span className='font-medium'>{item.name}</span>
              <span className='text-muted-foreground text-xs'>{item.description}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
