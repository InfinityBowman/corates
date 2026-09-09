import { useEffect } from 'react';
import { useRouter } from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { captureException } from '@/config/sentry';
import { TriangleAlertIcon, RefreshCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isStaleChunkError } from '@/lib/staleChunk';

export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter();
  const staleChunk = isStaleChunkError(error);

  useEffect(() => {
    captureException(error, { component: 'RouteError', action: 'render' });
  }, [error]);

  const message =
    import.meta.env.DEV ?
      error.message
    : 'This page hit an unexpected error. Try again, or reload the page if it keeps happening.';

  return (
    <div className='flex flex-1 items-center justify-center p-8'>
      <div className='border-border bg-card w-full max-w-sm rounded-xl border p-6 text-center shadow-sm'>
        <div className='bg-destructive/10 mx-auto mb-4 flex size-12 items-center justify-center rounded-full'>
          <TriangleAlertIcon className='text-destructive size-6' />
        </div>
        <h3 className='text-foreground mb-1 text-base font-semibold'>This page did not load</h3>
        <p className='text-muted-foreground mb-5 text-sm'>{message}</p>
        <Button onClick={() => (staleChunk ? window.location.reload() : router.invalidate())}>
          <RefreshCwIcon className='size-3.5' />
          {staleChunk ? 'Reload page' : 'Try again'}
        </Button>
      </div>
    </div>
  );
}
