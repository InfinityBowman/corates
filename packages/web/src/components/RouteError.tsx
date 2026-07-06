import { useEffect } from 'react';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { captureException } from '@/config/sentry';
import { TriangleAlertIcon, RefreshCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function RouteError({ error, reset }: ErrorComponentProps) {
  useEffect(() => {
    captureException(error, { component: 'RouteError', action: 'render' });
  }, [error]);

  const message =
    import.meta.env.DEV ? error.message : 'An unexpected error occurred. Please try again.';

  return (
    <div className='flex flex-1 items-center justify-center p-8'>
      <div className='border-border bg-card w-full max-w-sm rounded-xl border p-6 text-center shadow-sm'>
        <div className='bg-destructive/10 mx-auto mb-4 flex size-12 items-center justify-center rounded-full'>
          <TriangleAlertIcon className='text-destructive size-6' />
        </div>
        <h3 className='text-foreground mb-1 text-base font-semibold'>Something went wrong</h3>
        <p className='text-muted-foreground mb-5 text-sm'>{message}</p>
        <Button onClick={reset}>
          <RefreshCwIcon className='size-3.5' />
          Try again
        </Button>
      </div>
    </div>
  );
}
