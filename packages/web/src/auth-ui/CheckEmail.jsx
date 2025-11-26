import { createSignal, onMount, onCleanup } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { useBetterAuth } from '../api/better-auth-store.js';
import { AiOutlineLoading3Quarters, AiOutlineMail } from 'solid-icons/ai';

export default function CheckEmail() {
  const [loading, setLoading] = createSignal(false);
  const [resending, setResending] = createSignal(false);
  const [resent, setResent] = createSignal(false);
  const [error, setError] = createSignal('');
  const [checkInterval, setCheckInterval] = createSignal(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, resendVerificationEmail, session } = useBetterAuth();

  const email = () => searchParams.email || user()?.email || '';

  // Check if user is verified (without triggering reactive loops)
  const checkVerificationStatus = async (forceRefresh = false) => {
    try {
      // Only refresh session if explicitly requested
      if (forceRefresh) {
        await session().refetch?.();
      }

      // Get current user data
      const currentUser = user();
      console.log('Checking verification status:', {
        isAuthenticated: isAuthenticated(),
        user: currentUser,
        emailVerified: currentUser?.emailVerified,
        forceRefresh,
      });

      if (isAuthenticated() && currentUser?.emailVerified) {
        // User is now verified, redirect to dashboard
        console.log('Email verified! Redirecting to dashboard...');
        if (checkInterval()) {
          clearInterval(checkInterval());
          setCheckInterval(null);
        }
        setLoading(true);

        // Small delay for better UX
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 1000);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error checking verification status:', err);
      return false;
    }
  };

  // Simple polling function that doesn't force session refresh
  const pollVerificationStatus = () => {
    // Just check current state without refreshing
    const currentUser = user();
    if (isAuthenticated() && currentUser?.emailVerified) {
      checkVerificationStatus(false); // This will trigger the redirect
    }
  };

  onMount(() => {
    // Start simple polling every 5 seconds (without forcing session refresh)
    const interval = setInterval(pollVerificationStatus, 5000);
    setCheckInterval(interval);

    // Also check immediately (without refresh)
    pollVerificationStatus();

    // Add visibility change listener to check when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, checking verification status...');
        // When tab becomes visible, force a session refresh
        checkVerificationStatus(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });

  onCleanup(() => {
    if (checkInterval()) {
      clearInterval(checkInterval());
    }
  });

  const handleResendEmail = async () => {
    if (!email()) {
      setError('No email address found');
      return;
    }

    setResending(true);
    setError('');

    try {
      await resendVerificationEmail(email());
      setResent(true);

      // Reset the resent state after 5 seconds
      setTimeout(() => setResent(false), 5000);
    } catch (err) {
      setError('Failed to resend email. Please try again.');
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

              {error() && (
                <div class='p-3 text-red-600 text-xs sm:text-sm bg-red-50 border border-red-200 rounded-lg'>
                  {error()}
                </div>
              )}

              {resent() && (
                <div class='p-3 text-green-600 text-xs sm:text-sm bg-green-50 border border-green-200 rounded-lg'>
                  Verification email sent successfully!
                </div>
              )}
            </div>

            <div class='space-y-3'>
              <button
                onClick={handleResendEmail}
                disabled={resending()}
                class='w-full py-2 sm:py-3 text-sm sm:text-base bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg sm:rounded-xl shadow transition disabled:opacity-50 flex items-center justify-center'
              >
                {resending() ?
                  <div class='flex items-center'>
                    <AiOutlineLoading3Quarters class='animate-spin mr-2' size={18} />
                    Sending...
                  </div>
                : 'Resend Email'}
              </button>

              <button
                onClick={handleBackToSignIn}
                class='w-full py-2 sm:py-3 text-sm sm:text-base border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg sm:rounded-xl transition'
              >
                Back to Sign In
              </button>
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
