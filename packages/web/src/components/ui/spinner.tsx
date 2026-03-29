import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const spinnerVariants = cva('inline-block animate-spin rounded-full border-transparent', {
  variants: {
    size: {
      sm: 'h-4 w-4 border-2',
      md: 'h-6 w-6 border-2',
      lg: 'h-8 w-8 border-[3px]',
      xl: 'h-12 w-12 border-4',
    },
    variant: {
      default: 'border-t-primary border-r-primary',
      white: 'border-t-white border-r-white',
      gray: 'border-t-muted-foreground border-r-muted-foreground',
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'default',
  },
});

function Spinner({
  className,
  size,
  variant,
  label,
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof spinnerVariants> & {
    label?: string;
  }) {
  return (
    <div
      role='status'
      aria-label={label ?? 'Loading'}
      className={cn(spinnerVariants({ size, variant }), className)}
      {...props}
    />
  );
}

function PageLoader({
  className,
  label,
  ...props
}: React.ComponentProps<'div'> & { label?: string }) {
  return (
    <div className={cn('flex min-h-50 items-center justify-center', className)} {...props}>
      <Spinner size='lg' label={label} />
    </div>
  );
}

function LoadingPlaceholder({
  className,
  label,
  ...props
}: React.ComponentProps<'div'> & { label?: string }) {
  return (
    <div
      className={cn(
        'text-muted-foreground flex flex-col items-center justify-center gap-3 py-12',
        className,
      )}
      {...props}
    >
      <Spinner size='lg' />
      <span className='text-sm'>{label ?? 'Loading...'}</span>
    </div>
  );
}

function ButtonSpinner({ className, ...props }: React.ComponentProps<'div'>) {
  return <Spinner size='sm' variant='white' className={className} {...props} />;
}

export { Spinner, PageLoader, LoadingPlaceholder, ButtonSpinner, spinnerVariants };
