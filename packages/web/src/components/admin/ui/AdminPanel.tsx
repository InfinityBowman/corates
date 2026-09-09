/**
 * A titled panel of admin content. Same frame as SettingsSection, but the body
 * is unpadded by default so tables sit flush against the border.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AdminPanelProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Right side of the header bar: search, filters, refresh. */
  action?: ReactNode;
  /** Adds the standard inset around the body. */
  padded?: boolean;
  footer?: ReactNode;
  tone?: 'default' | 'destructive';
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function AdminPanel({
  title,
  description,
  action,
  padded,
  footer,
  tone = 'default',
  className,
  bodyClassName,
  children,
}: AdminPanelProps) {
  const destructive = tone === 'destructive';

  return (
    <section
      className={cn(
        'bg-card overflow-hidden rounded-xl border shadow-xs',
        destructive ? 'border-destructive/30' : 'border-border',
        className,
      )}
    >
      {(title || action) && (
        <div
          className={cn(
            'flex min-h-13 flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5',
            destructive ? 'border-destructive/20 bg-destructive/5' : 'border-border bg-muted/40',
          )}
        >
          <div className='min-w-0'>
            {title && (
              <h2
                className={cn(
                  'text-sm font-semibold',
                  destructive ? 'text-destructive' : 'text-foreground',
                )}
              >
                {title}
              </h2>
            )}
            {description && (
              <p className='text-muted-foreground mt-0.5 text-[13px]'>{description}</p>
            )}
          </div>
          {action && <div className='flex shrink-0 items-center gap-2'>{action}</div>}
        </div>
      )}

      <div className={cn(padded && 'p-4', bodyClassName)}>{children}</div>

      {footer && (
        <div className='border-border bg-muted/40 flex min-h-12 flex-wrap items-center justify-between gap-3 border-t px-4 py-2'>
          {footer}
        </div>
      )}
    </section>
  );
}
