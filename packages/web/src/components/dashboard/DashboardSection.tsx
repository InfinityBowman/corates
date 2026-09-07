/**
 * DashboardSection - a titled band of rows: header with count and optional
 * right-hand content, then the rows separated by hairlines.
 */

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardSectionProps {
  title: string;
  count?: number;
  aside?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function DashboardSection({ title, count, aside, children, style }: DashboardSectionProps) {
  return (
    <section className='border-border bg-card overflow-hidden rounded-lg border' style={style}>
      <div className='border-border bg-muted/40 flex h-9 items-center justify-between border-b px-4'>
        <div className='flex items-center gap-2'>
          <h2 className='text-[13px] font-semibold'>{title}</h2>
          {count != null && (
            <span className='text-muted-foreground text-xs font-medium tabular-nums'>{count}</span>
          )}
        </div>
        {aside && <div className='flex items-center gap-2'>{aside}</div>}
      </div>
      <div className='divide-border divide-y'>{children}</div>
    </section>
  );
}

/** Shared row layout; pass `interactive` for rows that open something on click. */
export function rowClass(interactive = true) {
  return cn(
    'group flex min-h-10 items-center gap-3 px-4 py-1.5 text-sm',
    interactive && 'hover:bg-muted/50 cursor-pointer transition-colors',
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className='flex flex-col items-center px-6 py-10 text-center'>
      <div className='bg-muted mb-3 flex size-11 items-center justify-center rounded-xl'>
        <Icon className='text-muted-foreground size-5' aria-hidden='true' />
      </div>
      <h3 className='text-foreground text-sm font-medium'>{title}</h3>
      <p className='text-muted-foreground mt-1 mb-4 max-w-sm text-sm'>{description}</p>
      {action}
    </div>
  );
}
