import { useState, useEffect, useRef, useCallback } from 'react';
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { z } from 'zod';
import { Loader2Icon, MailIcon } from 'lucide-react';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { Alert } from '@/components/ui/alert';
import { ErrorMessage } from '@/components/auth/ErrorMessage';
import { PrimaryButton, SecondaryButton } from '@/components/auth/AuthButtons';

const POLL_INTERVAL_MS = 3000;
const REDIRECT_DELAY_MS = 1000;
const RESENT_TIMEOUT_MS = 5000;

const checkEmailSearch = z.object({
  email: z.string().catch(''),
});

export const Route = createFileRoute('/_auth/check-email')({
  component: CheckEmailPage,
  validateSearch: checkEmailSearch,
});

function CheckEmailPage() {
  const { email: searchEmail } = useSearch({ from: '/_auth/check-email' });
  const [verified, setVerified] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const navigate = useNavigate();
  const user = useAuthStore(selectUser);
  const resendVerificationEmail = useAuthStore(s => s.resendVerificationEmail);
  const forceRefreshSession = useAuthStore(s => s.forceRefreshSession);
  const signout = useAuthStore(s => s.signout);

  const email = searchEmail || user?.email || '';

  const checkVerificationStatus = useCallback(
    async (forceRefresh = false) => {
      try {
        if (forceRefresh) {
          await forceRefreshSession();
        }

        const currentUser = useAuthStore.getState();
        const storeUser = selectUser(currentUser);

        if (storeUser?.emailVerified) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setProfileComplete(!!storeUser.profileCompletedAt);
          setVerified(true);
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error checking verification status:', err);
        return false;
      }
    },
    [forceRefreshSession],
  );

  // Set up polling and visibility change listener
  useEffect(() => {
    intervalRef.current = setInterval(() => checkVerificationStatus(true), POLL_INTERVAL_MS);
    checkVerificationStatus(true);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVerificationStatus(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkVerificationStatus]);

  // Redirect after verification with proper cleanup
  useEffect(() => {
    if (!verified) return;
    const timer = setTimeout(() => {
      if (!profileComplete) {
        navigate({ to: '/complete-profile', replace: true });
      } else {
        navigate({ to: '/dashboard', replace: true });
      }
    }, REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [verified, profileComplete, navigate]);

  async function handleResendEmail() {
    if (!email) {
      setError('No email address found');
      return;
    }

    setResending(true);
    setError('');

    try {
      await resendVerificationEmail(email);
      setResent(true);
      setTimeout(() => setResent(false), RESENT_TIMEOUT_MS);
    } catch (err) {
      console.warn('Failed to resend verification email:', (err as Error).message);
      setError('Failed to resend email. Please try again.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className='border-border bg-card relative flex w-full max-w-md flex-col gap-6 rounded-xl border p-6 text-center shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-12'>
      <a href='/' className='absolute top-4 left-4 sm:top-6 sm:left-6'>
        <img src='/logo.svg' alt='CoRATES' className='h-6 w-auto sm:h-7' />
      </a>

      {verified ?
        <>
          <div className='flex justify-center'>
            <Loader2Icon className='text-primary size-12 animate-spin' />
          </div>
          <h2 className='text-foreground text-xl font-bold sm:text-2xl'>Email Verified!</h2>
          <p className='text-muted-foreground text-sm sm:text-base'>
            {profileComplete ?
              'Redirecting you to the dashboard...'
            : 'Redirecting you to complete your profile...'}
          </p>
        </>
      : <>
          <div className='flex justify-center'>
            <div className='bg-primary/10 rounded-full p-4'>
              <MailIcon className='text-primary size-12' />
            </div>
          </div>

          <div>
            <h2 className='text-foreground mb-2 text-xl font-bold sm:text-2xl'>Check Your Email</h2>
            <p className='text-muted-foreground text-sm sm:text-base'>
              We&apos;ve sent a verification email to:
            </p>
            <p className='text-primary mt-1 text-sm font-semibold sm:text-base'>{email}</p>
          </div>

          <div className='flex flex-col gap-4'>
            <p className='text-muted-foreground text-xs sm:text-sm'>
              Click the verification link in your email to activate your account. Once verified,
              you&apos;ll automatically be redirected to the dashboard.
            </p>

            <ErrorMessage error={error} />

            {resent && (
              <Alert variant='success' className='text-xs sm:text-sm'>
                Verification email sent successfully!
              </Alert>
            )}
          </div>

          <div className='flex flex-col gap-3'>
            <PrimaryButton
              loading={resending}
              loadingText='Sending...'
              type='button'
              onClick={handleResendEmail}
            >
              Resend Email
            </PrimaryButton>

            <SecondaryButton
              onClick={async () => {
                await signout();
                navigate({ to: '/signin', replace: true });
              }}
            >
              Back to Sign In
            </SecondaryButton>
          </div>

          <div className='text-muted-foreground/70 text-xs sm:text-sm'>
            <p>Didn&apos;t receive the email? Check your spam folder or try resending.</p>
          </div>
        </>
      }
    </div>
  );
}
