import { createSignal, onMount, onCleanup } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import { AiOutlineLoading3Quarters, AiOutlineMail } from 'solid-icons/ai';
import ErrorMessage from './ErrorMessage.jsx';
import { PrimaryButton, SecondaryButton } from './AuthButtons.jsx';

const POLL_INTERVAL_MS = 3000;
const REDIRECT_DELAY_MS = 1000;
const RESENT_TIMEOUT_MS = 5000;

export default function CheckEmail() {
  const [loading, setLoading] = createSignal(false);
  const [resending, setResending] = createSignal(false);
  const [resent, setResent] = createSignal(false);
  const [displayError, setDisplayError] = createSignal('');
  const [checkInterval, setCheckInterval] = createSignal(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, resendVerificationEmail, session } = useBetterAuth();

  const email = () => searchParams.email || user()?.email || '';

  // Check if user is verified
  const checkVerificationStatus = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        // session() returns { data, isPending, refetch }
        const sessionObj = session();
        if (sessionObj?.refetch) {
          await sessionObj.refetch();
        }
      }

      const currentUser = user();

      if (isAuthenticated() && currentUser?.emailVerified) {
        if (checkInterval()) {
          clearInterval(checkInterval());
          setCheckInterval(null);
        }
        setLoading(true);

        // Capture completion now before the timeout
        const isProfileComplete = !!currentUser?.profileCompletedAt;

        setTimeout(() => {
          // Redirect to complete-profile if user hasn't completed setup yet
          // Otherwise go to dashboard
          if (!isProfileComplete) {
            navigate('/complete-profile', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        }, REDIRECT_DELAY_MS);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error checking verification status:', err);
      return false;
    }
  };

  // Polling function that refetches session from server
  const pollVerificationStatus = async () => {
    await checkVerificationStatus(true);
  };

  onMount(() => {
    const interval = setInterval(pollVerificationStatus, POLL_INTERVAL_MS);
    setCheckInterval(interval);

    // Check immediately
    pollVerificationStatus();

    // Check when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVerificationStatus(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    onCleanup(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    });
  });

  onCleanup(() => {
    if (checkInterval()) {
      clearInterval(checkInterval());
    }
  });

  const handleResendEmail = async () => {
    if (!email()) {
      setDisplayError('No email address found');
      return;
    }

    setResending(true);
    setDisplayError('');

    try {
      await resendVerificationEmail(email());
      setResent(true);
      setTimeout(() => setResent(false), RESENT_TIMEOUT_MS);
    } catch (err) {
      console.warn('Failed to resend verification email:', err.message);
      setDisplayError('Failed to resend email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleBackToSignIn = () => {
    navigate('/signin', { replace: true });
  };

  return (
    <div class='flex h-full items-center justify-center bg-blue-50 px-4 py-6 sm:py-12'>
      <div class='relative w-full max-w-md space-y-6 rounded-xl border border-gray-100 bg-white p-6 text-center shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-12'>
        {/* Logo */}
        <a href='/' class='absolute top-4 left-4 sm:top-6 sm:left-6'>
          <img src='/logo.svg' alt='CoRATES' class='h-6 w-auto sm:h-7' />
        </a>

        {loading() ?
          <>
            <div class='flex justify-center'>
              <AiOutlineLoading3Quarters
                class='animate-spin text-blue-600'
                size={48}
                role='status'
                aria-label='Verifying email'
              />
            </div>
            <h2 class='text-xl font-bold text-gray-900 sm:text-2xl'>Email Verified!</h2>
            <p class='text-sm text-gray-600 sm:text-base'>Redirecting you to the dashboard...</p>
          </>
        : <>
            <div class='flex justify-center'>
              <div class='rounded-full bg-blue-100 p-4'>
                <AiOutlineMail class='text-blue-600' size={48} />
              </div>
            </div>

            <div>
              <h2 class='mb-2 text-xl font-bold text-gray-900 sm:text-2xl'>Check Your Email</h2>
              <p class='text-sm text-gray-600 sm:text-base'>We've sent a verification email to:</p>
              <p class='mt-1 text-sm font-semibold text-blue-600 sm:text-base'>{email()}</p>
            </div>

            <div class='space-y-4'>
              <p class='text-xs text-gray-500 sm:text-sm'>
                Click the verification link in your email to activate your account. Once verified,
                you'll automatically be redirected to the dashboard.
              </p>

              <ErrorMessage displayError={displayError} />

              {resent() && (
                <div class='rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-600 sm:text-sm'>
                  Verification email sent successfully!
                </div>
              )}
            </div>

            <div class='space-y-3'>
              <PrimaryButton
                loading={resending()}
                loadingText='Sending...'
                type='button'
                onClick={handleResendEmail}
              >
                Resend Email
              </PrimaryButton>

              <SecondaryButton onClick={handleBackToSignIn}>Back to Sign In</SecondaryButton>
            </div>

            <div class='text-xs text-gray-400 sm:text-sm'>
              <p>Didn't receive the email? Check your spam folder or try resending.</p>
            </div>
          </>
        }
      </div>
    </div>
  );
}
