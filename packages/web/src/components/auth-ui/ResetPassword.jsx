import { createSignal, onMount, Show } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import { AnimatedShow } from '../AnimatedShow.jsx';
import ErrorMessage from './ErrorMessage.jsx';
import { PrimaryButton, AuthLink } from './AuthButtons.jsx';
import StrengthIndicator from './StrengthIndicator.jsx';
import { handleError } from '@/lib/error-utils.js';

const REDIRECT_DELAY_MS = 3000;

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = () => searchParams.token;

  return (
    <div class='flex h-full items-center justify-center bg-blue-50 px-4 py-8 sm:py-12'>
      <div class='w-full max-w-md space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-12'>
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
      await handleError(err, {
        setError,
        showToast: false,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div class='mb-2 text-center sm:mb-4'>
        <h2 class='mb-1 text-xl font-bold text-gray-900 sm:mb-2 sm:text-2xl'>Reset Password</h2>
        <p class='text-xs text-gray-500 sm:text-sm'>
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      <AnimatedShow when={success()}>
        <div class='rounded-lg border border-green-200 bg-green-50 p-4 text-center'>
          <p class='mb-1 text-sm font-medium text-green-700'>Reset Email Sent!</p>
          <p class='text-xs text-green-600'>
            Check your email for instructions to reset your password. Redirecting you to sign in...
          </p>
        </div>
      </AnimatedShow>

      <AnimatedShow when={!success()}>
        <form onSubmit={handleSubmit} class='space-y-4'>
          <div>
            <label
              class='mb-1 block text-xs font-semibold text-gray-700 sm:mb-2 sm:text-sm'
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
              class='w-full rounded-lg border border-gray-300 py-2 pr-3 pl-3 text-xs transition focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none sm:pr-4 sm:pl-4 sm:text-sm'
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

          <div class='mt-2 text-center text-xs text-gray-500 sm:mt-4 sm:text-sm'>
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
      await handleError(err, {
        setError,
        showToast: false,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div class='mb-2 text-center sm:mb-4'>
        <h2 class='mb-1 text-xl font-bold text-gray-900 sm:mb-2 sm:text-2xl'>Set New Password</h2>
        <p class='text-xs text-gray-500 sm:text-sm'>Enter your new password below.</p>
      </div>

      <AnimatedShow when={success()}>
        <div class='rounded-lg border border-green-200 bg-green-50 p-4 text-center'>
          <p class='mb-1 text-sm font-medium text-green-700'>Password Reset Successfully!</p>
          <p class='text-xs text-green-600'>
            Your password has been updated. Redirecting you to sign in...
          </p>
        </div>
      </AnimatedShow>

      <AnimatedShow when={!success()}>
        <form onSubmit={handleSubmit} class='space-y-4'>
          <div>
            <label
              class='mb-1 block text-xs font-semibold text-gray-700 sm:mb-2 sm:text-sm'
              for='password-input'
            >
              New Password
            </label>
            <input
              type='password'
              autoComplete='new-password'
              value={password()}
              onInput={e => setPassword(e.target.value)}
              class='w-full rounded-lg border border-gray-300 py-2 pr-3 pl-3 text-xs transition focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none sm:pr-4 sm:pl-4 sm:text-sm'
              required
              id='password-input'
              placeholder='Enter new password'
              disabled={loading()}
            />
            <StrengthIndicator password={password()} onUnmet={setUnmetRequirements} />
          </div>

          <div>
            <label
              class='mb-1 block text-xs font-semibold text-gray-700 sm:mb-2 sm:text-sm'
              for='confirm-password-input'
            >
              Confirm Password
            </label>
            <input
              type='password'
              autoComplete='new-password'
              value={confirmPassword()}
              onInput={e => setConfirmPassword(e.target.value)}
              class='w-full rounded-lg border border-gray-300 py-2 pr-3 pl-3 text-xs transition focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none sm:pr-4 sm:pl-4 sm:text-sm'
              required
              id='confirm-password-input'
              placeholder='Confirm new password'
              disabled={loading()}
            />
          </div>

          <ErrorMessage displayError={displayError} />

          <PrimaryButton loading={loading()} loadingText='Setting Password...'>
            Set Password
          </PrimaryButton>

          <div class='mt-2 text-center text-xs text-gray-500 sm:mt-4 sm:text-sm'>
            <AuthLink href='/reset-password'>Request a new reset link</AuthLink>
          </div>
        </form>
      </AnimatedShow>
    </>
  );
}
