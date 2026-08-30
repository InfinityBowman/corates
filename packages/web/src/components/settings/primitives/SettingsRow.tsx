/** One setting: label and description on the left, control on the right. */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsRowProps {
  label: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  media?: ReactNode;
  children?: ReactNode;
  /** Revealed below the row, inside the same cell. */
  expanded?: ReactNode;
  alignTop?: boolean;
  className?: string;
}

export function SettingsRow({
  label,
  description,
  meta,
  media,
  children,
  expanded,
  alignTop = false,
  className,
}: SettingsRowProps) {
  return (
    <div className={cn('px-5 py-4', className)}>
      <div
        className={cn(
          'flex flex-col gap-3 sm:flex-row sm:gap-4',
          alignTop ? 'sm:items-start' : 'sm:items-center',
        )}
      >
        {media && <div className='shrink-0'>{media}</div>}

        <div className='min-w-0 flex-1'>
          <div className='text-foreground text-sm font-medium'>{label}</div>
          {description && (
            <div className='text-muted-foreground mt-0.5 text-[13px] leading-relaxed'>
              {description}
            </div>
          )}
          {meta && <div className='text-muted-foreground/70 mt-1 text-xs'>{meta}</div>}
        </div>

        {children && <div className='flex shrink-0 items-center gap-2'>{children}</div>}
      </div>

      {expanded && <div className='mt-4'>{expanded}</div>}
    </div>
  );
}
