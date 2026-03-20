/**
 * Error message component with animation and accessibility
 */

import { cn } from '@/lib/utils';

interface ErrorMessageProps {
  error?: string | null;
  id?: string;
  className?: string;
}

export function ErrorMessage({ error, id, className }: ErrorMessageProps) {
  if (!error) return null;

  return (
    <div
      role='alert'
      aria-live='assertive'
      className={cn(
        'animate-in fade-in mt-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 duration-200 sm:text-sm',
        className,
      )}
    >
      <p id={id}>{error}</p>
    </div>
  );
}
