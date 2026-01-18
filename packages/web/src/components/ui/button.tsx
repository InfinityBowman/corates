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
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-blue-600 text-white hover:bg-blue-700',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
        ghost: 'hover:bg-gray-100 hover:text-gray-900',
        link: 'text-blue-600 underline-offset-4 hover:underline',
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
