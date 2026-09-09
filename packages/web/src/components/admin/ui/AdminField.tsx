/** Label/value pair for the detail grids on user, project and org pages. */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function AdminFieldGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {children}
    </dl>
  );
}

interface AdminFieldProps {
  label: string;
  children: ReactNode;
  /** Renders the value in the mono face used for ids and keys. */
  mono?: boolean;
  className?: string;
}

export function AdminField({ label, children, mono, className }: AdminFieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className='text-muted-foreground text-xs font-medium'>{label}</dt>
      <dd
        className={cn(
          'text-foreground mt-1 flex min-h-5 items-center gap-1 text-[13px]',
          mono && 'font-mono',
        )}
      >
        {children}
      </dd>
    </div>
  );
}
