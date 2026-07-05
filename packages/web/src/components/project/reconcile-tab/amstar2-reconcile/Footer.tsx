/**
 * Footer - Actions for the reconciliation summary view
 */

import { CheckIcon, ArrowLeftIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FooterProps {
  onBack: () => void;
  onSave: () => void;
  allAnswered: boolean;
  saving: boolean;
}

export function Footer({ onBack, onSave, allAnswered, saving }: FooterProps) {
  return (
    <div className='border-border bg-muted flex items-center justify-between border-t p-6'>
      <Button variant='outline' size='lg' onClick={onBack}>
        <ArrowLeftIcon className='size-4' />
        Back to Questions
      </Button>

      <Button size='lg' onClick={onSave} disabled={!allAnswered || saving}>
        {saving ?
          'Saving...'
        : <>
            <CheckIcon className='size-4' />
            Save Reconciled Checklist
          </>
        }
      </Button>
    </div>
  );
}
