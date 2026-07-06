/**
 * Social authentication buttons (Google, ORCID)
 */

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface SocialButtonProps {
  loading?: boolean;
  onClick?: () => void;
  iconOnly?: boolean;
}

export function GoogleButton({ loading, onClick, iconOnly }: SocialButtonProps) {
  if (iconOnly) {
    return (
      <Button
        type='button'
        variant='outline'
        size='icon'
        onClick={onClick}
        disabled={loading}
        className='size-auto rounded-lg p-3 sm:rounded-xl sm:p-3.5'
        title='Continue with Google'
        aria-label='Continue with Google'
      >
        {loading ?
          <Spinner
            size='sm'
            variant='current'
            label='Signing in with Google'
            className='size-5 sm:size-6'
          />
        : <img src='/logos/google.svg' alt='' className='size-5 sm:h-6 sm:w-6' aria-hidden='true' />
        }
      </Button>
    );
  }

  return (
    <Button
      type='button'
      variant='outline'
      onClick={onClick}
      disabled={loading}
      className='h-auto w-full gap-3 rounded-lg py-2.5 text-sm font-semibold sm:rounded-xl sm:py-3 sm:text-base'
    >
      {loading ?
        <Spinner size='sm' variant='current' label='Signing in with Google' className='size-5' />
      : <img src='/logos/google.svg' alt='' className='size-5' aria-hidden='true' />}
      Continue with Google
    </Button>
  );
}

export function OrcidButton({ loading, onClick, iconOnly }: SocialButtonProps) {
  if (iconOnly) {
    return (
      <Button
        type='button'
        variant='outline'
        size='icon'
        onClick={onClick}
        disabled={loading}
        className='size-auto rounded-lg p-3 sm:rounded-xl sm:p-3.5'
        title='Continue with ORCID'
        aria-label='Continue with ORCID'
      >
        {loading ?
          <Spinner
            size='sm'
            variant='current'
            label='Signing in with ORCID'
            className='size-5 sm:size-6'
          />
        : <img src='/logos/orcid.svg' alt='' className='size-5 sm:h-6 sm:w-6' aria-hidden='true' />}
      </Button>
    );
  }

  return (
    <Button
      type='button'
      variant='outline'
      onClick={onClick}
      disabled={loading}
      className='h-auto w-full gap-3 rounded-lg py-2.5 text-sm font-semibold sm:rounded-xl sm:py-3 sm:text-base'
    >
      {loading ?
        <Spinner size='sm' variant='current' label='Signing in with ORCID' className='size-5' />
      : <img src='/logos/orcid.svg' alt='' className='size-5' aria-hidden='true' />}
      Continue with ORCID
    </Button>
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
    <div className='relative my-2 sm:my-3'>
      <div className='absolute inset-0 flex items-center'>
        <div className='border-border w-full border-t' />
      </div>
      <div className='relative flex justify-center text-xs sm:text-sm'>
        <span className='bg-card text-muted-foreground px-3'>or</span>
      </div>
    </div>
  );
}
