/** A single figure in the stat row. Fixed height so the loading pass does not resize it. */

import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface AdminStatProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  loading?: boolean;
  /** Tints the value only; the tile itself stays neutral. */
  tone?: 'default' | 'success' | 'warning' | 'destructive';
  className?: string;
}

const TONE_CLASSES = {
  default: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
} as const;

export function AdminStat({
  label,
  value,
  hint,
  loading,
  tone = 'default',
  className,
}: AdminStatProps) {
  return (
    <div
      className={cn(
        'border-border bg-card flex h-22 flex-col justify-center gap-1 rounded-xl border px-4 shadow-xs',
        className,
      )}
    >
      <p className='text-muted-foreground truncate text-[13px] font-medium'>{label}</p>
      {loading ?
        <Skeleton className='h-7 w-14' />
      : <p className={cn('text-2xl leading-7 font-semibold tabular-nums', TONE_CLASSES[tone])}>
          {value}
        </p>
      }
      {hint && <p className='text-muted-foreground/70 truncate text-xs'>{hint}</p>}
    </div>
  );
}

/** Wraps stat tiles so every admin page uses the same responsive rhythm. */
export function AdminStatRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>{children}</div>;
}

/** Inline "working" affordance for panel headers, sized to not move the header. */
export function AdminRefreshSpinner({ active }: { active: boolean }) {
  return (
    <span className='inline-flex size-4 items-center justify-center'>
      {active && <Spinner size='sm' variant='current' />}
    </span>
  );
}
