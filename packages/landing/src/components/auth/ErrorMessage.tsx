/**
 * Error message component with animation and accessibility
 */

import { cn } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';

interface ErrorMessageProps {
  error?: string | null;
  id?: string;
  className?: string;
}

export function ErrorMessage({ error, id, className }: ErrorMessageProps) {
  if (!error) return null;

  return (
    <Alert
      variant='destructive'
      aria-live='assertive'
      className={cn('animate-in fade-in mt-1 px-2 py-1 text-xs duration-200 sm:text-sm', className)}
    >
      <p id={id}>{error}</p>
    </Alert>
  );
}
