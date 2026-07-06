/**
 * Shared button components for auth pages
 */

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
}

export function PrimaryButton({
  loading,
  loadingText,
  children,
  className,
  disabled,
  type = 'submit',
  ...props
}: PrimaryButtonProps) {
  return (
    <Button
      type={type}
      className={cn(
        'h-auto w-full rounded-lg border-0 py-2 text-sm font-bold shadow transition sm:rounded-xl sm:py-3 sm:text-base',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ?
        <span className='flex items-center'>
          <Spinner size='sm' variant='current' className='mr-2 size-5' />
          <span aria-live='polite'>{loadingText || 'Loading...'}</span>
        </span>
      : children}
    </Button>
  );
}

interface SecondaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export function SecondaryButton({
  children,
  className,
  type = 'button',
  ...props
}: SecondaryButtonProps) {
  return (
    <Button
      variant='outline'
      type={type}
      className={cn(
        'h-auto w-full rounded-lg py-2 text-sm font-semibold transition sm:rounded-xl sm:py-3 sm:text-base',
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}

interface AuthLinkProps extends React.AnchorHTMLAttributes<globalThis.HTMLAnchorElement> {
  children: React.ReactNode;
}

export function AuthLink({ children, className, ...props }: AuthLinkProps) {
  return (
    <a className={cn('text-primary font-semibold hover:underline', className)} {...props}>
      {children}
    </a>
  );
}
