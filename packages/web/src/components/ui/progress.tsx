import * as React from 'react';
import { Progress as ProgressPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot='progress'
      className={cn(
        'bg-secondary relative flex h-2 w-full items-center overflow-x-hidden rounded-full',
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot='progress-indicator'
        // Sized by width rather than translated, so the leading edge of a
        // partial fill is rounded instead of cut square.
        className='bg-primary h-full rounded-full transition-all'
        style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
