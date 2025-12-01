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

        setTimeout(() => {
          navigate('/dashboard', { replace: true });
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
    } catch {
      setDisplayError('Failed to resend email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleBackToSignIn = () => {
    navigate('/signin', { replace: true });
  };

  return (
    <div class='h-full bg-blue-50 flex items-center justify-center px-4 py-6 sm:py-12'>
      <div class='w-full max-w-md sm:max-w-xl bg-white rounded-xl sm:rounded-3xl shadow-2xl p-6 sm:p-12 text-center space-y-6 border border-gray-100'>
        {loading() ?
          <>
            <div class='flex justify-center'>
              <AiOutlineLoading3Quarters class='animate-spin text-blue-600' size={48} />
            </div>
            <h2 class='text-xl sm:text-2xl font-bold text-gray-900'>Email Verified!</h2>
            <p class='text-gray-600 text-sm sm:text-base'>Redirecting you to the dashboard...</p>
          </>
        : <>
            <div class='flex justify-center'>
              <div class='bg-blue-100 p-4 rounded-full'>
                <AiOutlineMail class='text-blue-600' size={48} />
              </div>
            </div>

            <div>
              <h2 class='text-xl sm:text-2xl font-bold text-gray-900 mb-2'>Check Your Email</h2>
              <p class='text-gray-600 text-sm sm:text-base'>We've sent a verification email to:</p>
              <p class='text-blue-600 font-semibold text-sm sm:text-base mt-1'>{email()}</p>
            </div>

            <div class='space-y-4'>
              <p class='text-gray-500 text-xs sm:text-sm'>
                Click the verification link in your email to activate your account. Once verified,
                you'll automatically be redirected to the dashboard.
              </p>

              <ErrorMessage displayError={displayError} />

              {resent() && (
                <div class='p-3 text-green-600 text-xs sm:text-sm bg-green-50 border border-green-200 rounded-lg'>
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

            <div class='text-xs sm:text-sm text-gray-400'>
              <p>Didn't receive the email? Check your spam folder or try resending.</p>
            </div>
          </>
        }
      </div>
    </div>
  );
}
