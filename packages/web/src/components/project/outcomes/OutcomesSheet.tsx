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
            Project-level outcomes used by ROB-2 and ROBINS-I checklists
          </SheetDescription>
        </SheetHeader>
        <div className='p-4'>
          <OutcomeManager />
        </div>
      </SheetContent>
    </Sheet>
  );
}
