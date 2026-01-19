/**
 * Spinner and loading components.
 *
 * @example
 * // Basic spinner
 * <Spinner />
 *
 * // Large spinner
 * <Spinner size="lg" />
 *
 * // White spinner (for dark backgrounds)
 * <Spinner variant="white" />
 *
 * @example
 * // Page loader (centered with min-height)
 * <PageLoader />
 *
 * @example
 * // Loading placeholder with text
 * <LoadingPlaceholder label="Loading projects..." />
 *
 * @example
 * // Button spinner (small, white)
 * <Button disabled>
 *   <ButtonSpinner />
 *   Saving...
 * </Button>
 */
import type { Component, ComponentProps } from 'solid-js';
import { splitProps } from 'solid-js';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

const spinnerVariants = cva('inline-block animate-spin rounded-full border-transparent', {
  variants: {
    size: {
      sm: 'h-4 w-4 border-2',
      md: 'h-6 w-6 border-2',
      lg: 'h-8 w-8 border-[3px]',
      xl: 'h-12 w-12 border-4',
    },
    variant: {
      default: 'border-t-blue-600 border-r-blue-600',
      white: 'border-t-white border-r-white',
      gray: 'border-t-muted-foreground border-r-muted-foreground',
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'default',
  },
});

type SpinnerProps = ComponentProps<'div'> &
  VariantProps<typeof spinnerVariants> & {
    label?: string;
  };

const Spinner: Component<SpinnerProps> = props => {
  const [local, others] = splitProps(props, ['size', 'variant', 'class', 'label']);
  return (
    <div
      role='status'
      aria-label={local.label ?? 'Loading'}
      class={cn(spinnerVariants({ size: local.size, variant: local.variant }), local.class)}
      {...others}
    />
  );
};

type PageLoaderProps = ComponentProps<'div'> & {
  label?: string;
};

const PageLoader: Component<PageLoaderProps> = props => {
  const [local, others] = splitProps(props, ['class', 'label']);
  return (
    <div class={cn('flex min-h-50 items-center justify-center', local.class)} {...others}>
      <Spinner size='lg' label={local.label} />
    </div>
  );
};

type LoadingPlaceholderProps = ComponentProps<'div'> & {
  label?: string;
};

const LoadingPlaceholder: Component<LoadingPlaceholderProps> = props => {
  const [local, others] = splitProps(props, ['class', 'label']);
  return (
    <div
      class={cn(
        'text-muted-foreground flex flex-col items-center justify-center gap-3 py-12',
        local.class,
      )}
      {...others}
    >
      <Spinner size='lg' />
      <span class='text-sm'>{local.label ?? 'Loading...'}</span>
    </div>
  );
};

type ButtonSpinnerProps = ComponentProps<'div'>;

const ButtonSpinner: Component<ButtonSpinnerProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return <Spinner size='sm' variant='white' class={local.class} {...others} />;
};

export { Spinner, PageLoader, LoadingPlaceholder, ButtonSpinner, spinnerVariants };
export type { SpinnerProps };
