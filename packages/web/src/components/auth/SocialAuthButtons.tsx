/**
 * Social authentication buttons (Google, ORCID)
 */

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface SocialButtonProps {
  loading?: boolean;
  onClick?: () => void;
}

const SOCIAL_BUTTON_CLASS =
  'h-auto w-full gap-3 rounded-lg py-2.5 text-sm font-medium sm:rounded-xl sm:py-3';

export function GoogleButton({ loading, onClick }: SocialButtonProps) {
  return (
    <Button
      type='button'
      variant='outline'
      onClick={onClick}
      disabled={loading}
      className={SOCIAL_BUTTON_CLASS}
    >
      {loading ?
        <Spinner size='sm' variant='current' label='Signing in with Google' className='size-5' />
      : <img src='/logos/google.svg' alt='' className='size-5' aria-hidden='true' />}
      Continue with Google
    </Button>
  );
}

export function OrcidButton({ loading, onClick }: SocialButtonProps) {
  return (
    <Button
      type='button'
      variant='outline'
      onClick={onClick}
      disabled={loading}
      className={SOCIAL_BUTTON_CLASS}
    >
      {loading ?
        <Spinner size='sm' variant='current' label='Signing in with ORCID' className='size-5' />
      : <img src='/logos/orcid.svg' alt='' className='size-5' aria-hidden='true' />}
      Continue with ORCID
    </Button>
  );
}

export function SocialAuthContainer({ children }: { children: React.ReactNode }) {
  return <div className='flex w-full flex-col gap-3'>{children}</div>;
}

// The margins suit block layouts; a flex parent with its own gap passes my-0.
export function AuthDivider({ className }: { className?: string }) {
  return (
    <div className={cn('relative my-2 sm:my-3', className)}>
      <div className='absolute inset-0 flex items-center'>
        <div className='border-border w-full border-t' />
      </div>
      <div className='relative flex justify-center text-xs sm:text-sm'>
        <span className='bg-card text-muted-foreground px-3'>or</span>
      </div>
    </div>
  );
}
