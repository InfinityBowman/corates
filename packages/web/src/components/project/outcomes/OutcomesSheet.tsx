/**
 * OutcomesSheet - Hosts OutcomeManager in a side sheet, opened from the
 * project header metadata line.
 */

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { OutcomeManager } from './OutcomeManager';

interface OutcomesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OutcomesSheet({ open, onOpenChange }: OutcomesSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='w-full gap-0 overflow-y-auto sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>Outcomes</SheetTitle>
          <SheetDescription>
            An outcome is the result you appraise, such as all-cause mortality. RoB 2 and ROBINS-I
            checklists are completed once per outcome, so every study in this project can be
            appraised against the same list.
          </SheetDescription>
        </SheetHeader>
        <div className='p-4'>
          <OutcomeManager />
        </div>
      </SheetContent>
    </Sheet>
  );
}
