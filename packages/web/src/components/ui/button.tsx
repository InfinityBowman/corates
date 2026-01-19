/**
 * Button component with variants and sizes.
 *
 * @example
 * // Default button
 * <Button>Click me</Button>
 *
 * // Destructive button
 * <Button variant="destructive">Delete</Button>
 *
 * // Outline button with small size
 * <Button variant="outline" size="sm">Cancel</Button>
 *
 * // Icon button
 * <Button variant="ghost" size="icon"><FiSettings /></Button>
 *
 * // Loading state (combine with Spinner)
 * <Button disabled><ButtonSpinner /> Saving...</Button>
 */
import type { Component, ComponentProps, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-border bg-card text-secondary-foreground hover:bg-muted',
        secondary: 'bg-secondary text-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-muted hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3 text-xs',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    children?: JSX.Element;
  };

const Button: Component<ButtonProps> = props => {
  const [local, others] = splitProps(props, ['variant', 'size', 'class']);

  return (
    <button
      type='button'
      class={cn(buttonVariants({ variant: local.variant, size: local.size }), local.class)}
      {...others}
    />
  );
};

export { Button, buttonVariants };
export type { ButtonProps };
