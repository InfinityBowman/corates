import { createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import { AnimatedShow } from '../AnimatedShow.jsx';
import ErrorMessage from './ErrorMessage.jsx';
import { PrimaryButton, AuthLink } from './AuthButtons.jsx';

const REDIRECT_DELAY_MS = 3000;

export default function ResetPassword() {
  const [email, setEmail] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [success, setSuccess] = createSignal(false);
  const navigate = useNavigate();
  const { resetPassword, authError } = useBetterAuth();

  const displayError = () => error() || authError();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email()) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      await resetPassword(email());
      setSuccess(true);

      setTimeout(() => {
        navigate('/signin');
      }, REDIRECT_DELAY_MS);
    } catch (err) {
      console.error('Reset password error:', err);

      if (err.message?.includes('User not found')) {
        setError('No account found with this email address');
      } else if (err.message?.includes('Too many requests')) {
        setError('Too many reset attempts. Please try again later.');
      } else if (err.message?.includes('Invalid email')) {
        setError('Please enter a valid email address');
      } else {
        setError(err.message || 'Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class='h-full bg-blue-50 flex items-center justify-center px-4 py-8 sm:py-12'>
      <div class='w-full max-w-md sm:max-w-xl bg-white rounded-xl sm:rounded-3xl shadow-2xl p-6 sm:p-12 space-y-4 border border-gray-100'>
        <div class='mb-2 sm:mb-4 text-center'>
          <h2 class='text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2'>Reset Password</h2>
          <p class='text-gray-500 text-xs sm:text-sm'>
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <AnimatedShow when={success()}>
          <div class='p-4 bg-green-50 border border-green-200 rounded-lg text-center'>
            <p class='text-green-700 text-sm font-medium mb-1'>Reset Email Sent!</p>
            <p class='text-green-600 text-xs'>
              Check your email for instructions to reset your password. Redirecting you to sign
              in...
            </p>
          </div>
        </AnimatedShow>

        <AnimatedShow when={!success()}>
          <form onSubmit={handleSubmit} class='space-y-4'>
            <div>
              <label
                class='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
                for='email-input'
              >
                Email Address
              </label>
              <input
                type='email'
                autoComplete='email'
                autocapitalize='off'
                spellCheck='false'
                value={email()}
                onInput={e => setEmail(e.target.value)}
                class='w-full pl-3 sm:pl-4 pr-3 sm:pr-4 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition'
                required
                id='email-input'
                placeholder='you@example.com'
                disabled={loading()}
              />
            </div>

            <ErrorMessage displayError={displayError} />

            <PrimaryButton loading={loading()} loadingText='Sending Email...'>
              Send Reset Email
            </PrimaryButton>

            <div class='text-center text-xs sm:text-sm text-gray-500 mt-2 sm:mt-4'>
              Remember your password?{' '}
              <AuthLink
                href='/signin'
                onClick={e => {
                  e.preventDefault();
                  navigate('/signin');
                }}
              >
                Sign In
              </AuthLink>
            </div>
          </form>
        </AnimatedShow>
      </div>
    </div>
  );
}
