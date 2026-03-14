/**
 * Shared button components for auth pages
 */

import { Loader2Icon } from 'lucide-react';
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
    <button
      type={type}
      className={cn(
        'flex w-full items-center justify-center rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground shadow transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-xl sm:py-3 sm:text-base',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center">
          <Loader2Icon className="mr-2 h-5 w-5 animate-spin" />
          <span aria-live="polite">{loadingText || 'Loading...'}</span>
        </span>
      ) : (
        children
      )}
    </button>
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
    <button
      type={type}
      className={cn(
        'w-full rounded-lg border border-border py-2 text-sm font-semibold text-secondary-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-xl sm:py-3 sm:text-base',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

interface AuthLinkProps extends React.AnchorHTMLAttributes<globalThis.HTMLAnchorElement> {
  children: React.ReactNode;
}

export function AuthLink({ children, className, ...props }: AuthLinkProps) {
  return (
    <a
      className={cn('font-semibold text-primary hover:underline', className)}
      {...props}
    >
      {children}
    </a>
  );
}
