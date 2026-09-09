/** Empty and error states for admin panels, sized so they hold a table's place. */

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AdminEmptyProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function AdminEmpty({ icon: Icon, title, description, action, className }: AdminEmptyProps) {
  return (
    <div
      className={cn(
        'flex min-h-40 flex-col items-center justify-center gap-1 px-6 py-10 text-center',
        className,
      )}
    >
      {Icon && <Icon className='text-muted-foreground/40 mb-1 size-6' />}
      <p className='text-foreground text-sm font-medium'>{title}</p>
      {description && <p className='text-muted-foreground text-[13px]'>{description}</p>}
      {action && <div className='mt-3'>{action}</div>}
    </div>
  );
}

interface AdminErrorProps {
  title: string;
  description?: ReactNode;
  onRetry?: () => void;
  className?: string;
}

export function AdminError({ title, description, onRetry, className }: AdminErrorProps) {
  return (
    <div
      className={cn(
        'border-destructive/30 bg-destructive/5 flex min-h-40 flex-col items-center justify-center gap-1 rounded-xl border px-6 py-10 text-center',
        className,
      )}
    >
      <AlertCircleIcon className='text-destructive mb-1 size-6' />
      <p className='text-foreground text-sm font-medium'>{title}</p>
      {description && <p className='text-muted-foreground text-[13px]'>{description}</p>}
      {onRetry && (
        <Button type='button' variant='outline' size='sm' onClick={onRetry} className='mt-3'>
          Try again
        </Button>
      )}
    </div>
  );
}
