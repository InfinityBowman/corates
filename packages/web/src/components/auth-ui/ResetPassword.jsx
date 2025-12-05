import { createSignal, onMount, Show } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import { AnimatedShow } from '../AnimatedShow.jsx';
import ErrorMessage from './ErrorMessage.jsx';
import { PrimaryButton, AuthLink } from './AuthButtons.jsx';
import StrengthIndicator from './StrengthIndicator.jsx';

const REDIRECT_DELAY_MS = 3000;

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = () => searchParams.token;

  return (
    <div class='h-full bg-blue-50 flex items-center justify-center px-4 py-8 sm:py-12'>
      <div class='w-full max-w-md sm:max-w-xl bg-white rounded-xl sm:rounded-3xl shadow-2xl p-6 sm:p-12 space-y-4 border border-gray-100'>
        <Show when={token()} fallback={<RequestResetForm />}>
          <SetNewPasswordForm token={token()} />
        </Show>
      </div>
    </div>
  );
}

// Form to request a password reset email
function RequestResetForm() {
  const [email, setEmail] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [success, setSuccess] = createSignal(false);
  const navigate = useNavigate();
  const { resetPassword, authError, clearAuthError } = useBetterAuth();

  onMount(() => clearAuthError());

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

      const msg = err.message?.toLowerCase() || '';

      if (msg.includes('user not found')) {
        setError('No account found with this email address');
      } else if (msg.includes('too many requests')) {
        setError('Too many reset attempts. Please try again later.');
      } else if (msg.includes('invalid email')) {
        setError('Please enter a valid email address');
      } else if (
        msg.includes('failed to fetch') ||
        msg.includes('load failed') ||
        msg.includes('network') ||
        msg.includes('cors')
      ) {
        setError(
          'Unable to connect to the server. Please check your internet connection and try again.',
        );
      } else if (msg.includes('timeout')) {
        setError('The request timed out. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
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
            Check your email for instructions to reset your password. Redirecting you to sign in...
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
            Remember your password? <AuthLink href='/signin'>Sign In</AuthLink>
          </div>
        </form>
      </AnimatedShow>
    </>
  );
}

// Form to set a new password with the token
function SetNewPasswordForm(props) {
  const [password, setPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [success, setSuccess] = createSignal(false);
  const [unmetRequirements, setUnmetRequirements] = createSignal([]);
  const navigate = useNavigate();
  const { confirmPasswordReset, authError, clearAuthError } = useBetterAuth();

  onMount(() => clearAuthError());

  const displayError = () => error() || authError();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!password()) {
      setError('Please enter a new password');
      return;
    }

    // Check password strength requirements
    if (unmetRequirements().length > 0) {
      setError(`Password must have ${unmetRequirements().join(', ')}`);
      return;
    }

    if (password() !== confirmPassword()) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await confirmPasswordReset(props.token, password());
      setSuccess(true);

      setTimeout(() => {
        navigate('/signin');
      }, REDIRECT_DELAY_MS);
    } catch (err) {
      console.error('Confirm reset password error:', err);

      const msg = err.message?.toLowerCase() || '';

      if (msg.includes('invalid') || msg.includes('expired')) {
        setError('This reset link is invalid or has expired. Please request a new one.');
      } else if (msg.includes('password')) {
        setError('Password does not meet requirements. Please try a stronger password.');
      } else if (
        msg.includes('failed to fetch') ||
        msg.includes('load failed') ||
        msg.includes('network')
      ) {
        setError('Unable to connect to the server. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div class='mb-2 sm:mb-4 text-center'>
        <h2 class='text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2'>Set New Password</h2>
        <p class='text-gray-500 text-xs sm:text-sm'>Enter your new password below.</p>
      </div>

      <AnimatedShow when={success()}>
        <div class='p-4 bg-green-50 border border-green-200 rounded-lg text-center'>
          <p class='text-green-700 text-sm font-medium mb-1'>Password Reset Successfully!</p>
          <p class='text-green-600 text-xs'>
            Your password has been updated. Redirecting you to sign in...
          </p>
        </div>
      </AnimatedShow>

      <AnimatedShow when={!success()}>
        <form onSubmit={handleSubmit} class='space-y-4'>
          <div>
            <label
              class='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
              for='password-input'
            >
              New Password
            </label>
            <input
              type='password'
              autoComplete='new-password'
              value={password()}
              onInput={e => setPassword(e.target.value)}
              class='w-full pl-3 sm:pl-4 pr-3 sm:pr-4 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition'
              required
              id='password-input'
              placeholder='Enter new password'
              disabled={loading()}
            />
            <StrengthIndicator password={password()} onUnmet={setUnmetRequirements} />
          </div>

          <div>
            <label
              class='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
              for='confirm-password-input'
            >
              Confirm Password
            </label>
            <input
              type='password'
              autoComplete='new-password'
              value={confirmPassword()}
              onInput={e => setConfirmPassword(e.target.value)}
              class='w-full pl-3 sm:pl-4 pr-3 sm:pr-4 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition'
              required
              id='confirm-password-input'
              placeholder='Confirm new password'
              disabled={loading()}
            />
          </div>

          <ErrorMessage displayError={displayError} />

          <PrimaryButton loading={loading()} loadingText='Resetting Password...'>
            Reset Password
          </PrimaryButton>

          <div class='text-center text-xs sm:text-sm text-gray-500 mt-2 sm:mt-4'>
            <AuthLink href='/reset-password'>Request a new reset link</AuthLink>
          </div>
        </form>
      </AnimatedShow>
    </>
  );
}
