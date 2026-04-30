import { useEffect } from 'react';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { captureException } from '@/config/sentry';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircleIcon } from 'lucide-react';

export function RouteError({ error, reset }: ErrorComponentProps) {
  useEffect(() => {
    captureException(error, { component: 'RouteError', action: 'render' });
  }, [error]);

  const message =
    import.meta.env.DEV ? error.message : 'An unexpected error occurred. Please try again.';

  return (
    <div className='flex flex-1 items-center justify-center p-8'>
      <Alert variant='destructive' className='max-w-md'>
        <AlertCircleIcon />
        <div>
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
          <button
            type='button'
            onClick={reset}
            className='text-destructive hover:text-destructive/80 mt-3 text-sm font-medium'
          >
            Try again
          </button>
        </div>
      </Alert>
    </div>
  );
}
