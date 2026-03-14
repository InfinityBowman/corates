/**
 * Social authentication buttons (Google, ORCID)
 */

import { cn } from '@/lib/utils';

interface SocialButtonProps {
  loading?: boolean;
  onClick?: () => void;
  iconOnly?: boolean;
}

export function GoogleButton({ loading, onClick, iconOnly }: SocialButtonProps) {
  const baseClass =
    'border border-border hover:bg-muted text-secondary-foreground font-semibold rounded-lg sm:rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center';

  if (iconOnly) {
    return (
      <button
        type='button'
        onClick={onClick}
        disabled={loading}
        className={cn(baseClass, 'p-3 sm:p-3.5')}
        title='Continue with Google'
        aria-label='Continue with Google'
      >
        {loading ?
          <div
            role='status'
            aria-label='Signing in with Google'
            className='border-border border-t-secondary-foreground h-5 w-5 animate-spin rounded-full border-2 sm:h-6 sm:w-6'
          />
        : <img
            src='/logos/google.svg'
            alt=''
            className='h-5 w-5 sm:h-6 sm:w-6'
            aria-hidden='true'
          />
        }
      </button>
    );
  }

  return (
    <button
      type='button'
      onClick={onClick}
      disabled={loading}
      className={cn(baseClass, 'w-full gap-3 py-2.5 text-sm sm:py-3 sm:text-base')}
    >
      {loading ?
        <div
          role='status'
          aria-label='Signing in with Google'
          className='border-border border-t-secondary-foreground h-5 w-5 animate-spin rounded-full border-2'
        />
      : <img src='/logos/google.svg' alt='' className='h-5 w-5' aria-hidden='true' />}
      Continue with Google
    </button>
  );
}

export function OrcidButton({ loading, onClick, iconOnly }: SocialButtonProps) {
  const baseClass =
    'border border-border hover:bg-muted text-secondary-foreground font-semibold rounded-lg sm:rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center';

  if (iconOnly) {
    return (
      <button
        type='button'
        onClick={onClick}
        disabled={loading}
        className={cn(baseClass, 'p-3 sm:p-3.5')}
        title='Continue with ORCID'
        aria-label='Continue with ORCID'
      >
        {loading ?
          <div
            role='status'
            aria-label='Signing in with ORCID'
            className='border-border border-t-secondary-foreground h-5 w-5 animate-spin rounded-full border-2 sm:h-6 sm:w-6'
          />
        : <img src='/logos/orcid.svg' alt='' className='h-5 w-5 sm:h-6 sm:w-6' aria-hidden='true' />
        }
      </button>
    );
  }

  return (
    <button
      type='button'
      onClick={onClick}
      disabled={loading}
      className={cn(baseClass, 'w-full gap-3 py-2.5 text-sm sm:py-3 sm:text-base')}
    >
      {loading ?
        <div
          role='status'
          aria-label='Signing in with ORCID'
          className='border-border border-t-secondary-foreground h-5 w-5 animate-spin rounded-full border-2'
        />
      : <img src='/logos/orcid.svg' alt='' className='h-5 w-5' aria-hidden='true' />}
      Continue with ORCID
    </button>
  );
}

interface SocialAuthContainerProps {
  children: React.ReactNode;
  buttonCount?: number;
}

export function SocialAuthContainer({ children, buttonCount = 1 }: SocialAuthContainerProps) {
  const isCompact = buttonCount > 1;
  return <div className={isCompact ? 'flex justify-center gap-3' : 'w-full'}>{children}</div>;
}

export function AuthDivider() {
  return (
    <div className='relative my-4 sm:my-5'>
      <div className='absolute inset-0 flex items-center'>
        <div className='border-border w-full border-t' />
      </div>
      <div className='relative flex justify-center text-xs sm:text-sm'>
        <span className='bg-card text-muted-foreground px-3'>or</span>
      </div>
    </div>
  );
}
