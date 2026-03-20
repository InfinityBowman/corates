import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative flex items-start gap-3 rounded-lg border px-4 py-3 text-sm [&>svg]:shrink-0 [&>svg]:size-4 [&>svg]:translate-y-0.5',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground border-border',
        destructive: 'border-red-200 bg-red-50 text-red-800 [&>svg]:text-red-600',
        warning: 'border-amber-200 bg-amber-50 text-amber-800 [&>svg]:text-amber-600',
        success: 'border-green-200 bg-green-50 text-green-800 [&>svg]:text-green-600',
        info: 'border-blue-200 bg-blue-50 text-blue-800 [&>svg]:text-blue-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot='alert'
      role='alert'
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot='alert-title' className={cn('leading-snug font-medium', className)} {...props} />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot='alert-description' className={cn('text-sm opacity-90', className)} {...props} />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot='alert-action' className={cn('absolute top-2 right-2', className)} {...props} />
  );
}

export { Alert, AlertTitle, AlertDescription, AlertAction, alertVariants };
