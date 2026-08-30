/** A titled panel of settings rows. */

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsSectionProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  tone?: 'default' | 'destructive';
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function SettingsSection({
  title,
  description,
  icon: Icon,
  action,
  tone = 'default',
  footer,
  className,
  children,
}: SettingsSectionProps) {
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
            'flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5',
            destructive ? 'border-destructive/20 bg-destructive/5' : 'border-border bg-muted/40',
          )}
        >
          <div className='flex min-w-0 items-center gap-2.5'>
            {Icon && (
              <Icon
                className={cn('size-4 shrink-0', destructive ? 'text-destructive' : 'text-primary')}
              />
            )}
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
          </div>
          {action}
        </div>
      )}

      <div className='divide-border divide-y'>{children}</div>

      {footer && (
        <div className='border-border bg-muted/40 flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3'>
          {footer}
        </div>
      )}
    </section>
  );
}
