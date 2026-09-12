// Directory views where the table is the page: only the rows scroll, between a
// header bar and pinned paging.

import type { ReactNode } from 'react';

interface AdminListPageProps {
  title: string;
  /** Total matching rows, not the number on this page. */
  count?: number;
  filters?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function AdminListPage({ title, count, filters, footer, children }: AdminListPageProps) {
  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <header className='border-border flex h-13 shrink-0 items-center gap-3 border-b px-6'>
        <h1 className='text-foreground text-[15px] font-semibold'>{title}</h1>
        {count !== undefined && (
          <span className='text-muted-foreground text-[13px] tabular-nums'>{count}</span>
        )}
        {filters && <div className='flex min-w-0 flex-1 items-center gap-2'>{filters}</div>}
      </header>

      <div className='flex min-h-0 flex-1 flex-col'>{children}</div>

      {footer && (
        <div className='border-border text-muted-foreground flex h-11 shrink-0 items-center justify-between gap-3 border-t px-6 text-[13px]'>
          {footer}
        </div>
      )}
    </div>
  );
}
