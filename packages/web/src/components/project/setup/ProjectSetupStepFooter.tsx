/**
 * Shared footer for setup steps: back navigation on the right, primary action last.
 */

import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface ProjectSetupStepFooterProps {
  hint?: string;
  backLabel?: string;
  onBack?: () => void;
  backDisabled?: boolean;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  isLoading?: boolean;
}

export function ProjectSetupStepFooter({
  hint,
  backLabel = 'Back',
  onBack,
  backDisabled = false,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  isLoading = false,
}: ProjectSetupStepFooterProps) {
  return (
    <div className='mt-auto flex items-center justify-between border-t pt-5'>
      <p className='text-muted-foreground text-xs'>{hint}</p>
      <div className='flex items-center gap-3'>
        {onBack && (
          <Button
            type='button'
            variant='ghost'
            onClick={onBack}
            disabled={backDisabled || isLoading}
          >
            <ArrowLeftIcon />
            {backLabel}
          </Button>
        )}
        {onPrimary && primaryLabel && (
          <Button onClick={onPrimary} disabled={primaryDisabled || isLoading}>
            {isLoading ?
              <>
                <Spinner size='sm' variant='current' />
                Saving...
              </>
            : <>
                {primaryLabel}
                <ArrowRightIcon />
              </>
            }
          </Button>
        )}
      </div>
    </div>
  );
}
