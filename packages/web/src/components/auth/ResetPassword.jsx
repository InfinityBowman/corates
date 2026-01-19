import { createSignal, onMount, Show } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import { AnimatedShow } from '../AnimatedShow.jsx';
import ErrorMessage from './ErrorMessage.jsx';
import { PrimaryButton, AuthLink } from './AuthButtons.jsx';
import StrengthIndicator from './StrengthIndicator.jsx';
import {
  PasswordInput,
  PasswordInputControl,
  PasswordInputField,
  PasswordInputVisibilityTrigger,
} from '@/components/ui/password-input';
import { handleError } from '@/lib/error-utils.js';

const REDIRECT_DELAY_MS = 3000;

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = () => searchParams.token;

  return (
    <div class='border-border-subtle bg-card relative w-full max-w-md space-y-4 rounded-xl border p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-12'>
      {/* Logo */}
      <a href='/' class='absolute top-4 left-4 sm:top-6 sm:left-6'>
        <img src='/logo.svg' alt='CoRATES' class='h-6 w-auto sm:h-7' />
      </a>

      <Show when={token()} fallback={<RequestResetForm />}>
        <SetNewPasswordForm token={token()} />
      </Show>
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
        <h2 class='text-foreground mb-1 text-xl font-bold sm:mb-2 sm:text-2xl'>Reset Password</h2>
        <p class='text-muted-foreground text-xs sm:text-sm'>
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
              class='text-secondary-foreground mb-1 block text-xs font-semibold sm:mb-2 sm:text-sm'
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
              class='border-border focus:ring-primary w-full rounded-lg border py-2 pr-3 pl-3 text-xs transition focus:border-transparent focus:ring-2 focus:outline-none sm:pr-4 sm:pl-4 sm:text-sm'
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

          <div class='text-muted-foreground mt-2 text-center text-xs sm:mt-4 sm:text-sm'>
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
        <h2 class='text-foreground mb-1 text-xl font-bold sm:mb-2 sm:text-2xl'>Set New Password</h2>
        <p class='text-muted-foreground text-xs sm:text-sm'>Enter your new password below.</p>
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
              class='text-secondary-foreground mb-1 block text-xs font-semibold sm:mb-2 sm:text-sm'
              for='new-password-input'
            >
              New Password
            </label>
            <PasswordInput autoComplete='new-password' disabled={loading()} required>
              <PasswordInputControl>
                <PasswordInputField
                  id='new-password-input'
                  value={password()}
                  onInput={e => setPassword(e.target.value)}
                  placeholder='Enter new password'
                  aria-describedby={displayError() ? 'reset-password-error' : undefined}
                />
                <PasswordInputVisibilityTrigger />
              </PasswordInputControl>
            </PasswordInput>
            <StrengthIndicator password={password()} onUnmet={setUnmetRequirements} />
          </div>

          <div>
            <label
              class='text-secondary-foreground mb-1 block text-xs font-semibold sm:mb-2 sm:text-sm'
              for='confirm-password-input'
            >
              Confirm Password
            </label>
            <PasswordInput autoComplete='new-password' disabled={loading()} required>
              <PasswordInputControl>
                <PasswordInputField
                  id='confirm-password-input'
                  value={confirmPassword()}
                  onInput={e => setConfirmPassword(e.target.value)}
                  placeholder='Confirm new password'
                  aria-describedby={displayError() ? 'reset-password-error' : undefined}
                />
                <PasswordInputVisibilityTrigger />
              </PasswordInputControl>
            </PasswordInput>
          </div>

          <ErrorMessage displayError={displayError} id='reset-password-error' />

          <PrimaryButton loading={loading()} loadingText='Setting Password...'>
            Set Password
          </PrimaryButton>

          <div class='text-muted-foreground mt-2 text-center text-xs sm:mt-4 sm:text-sm'>
            <AuthLink href='/reset-password'>Request a new reset link</AuthLink>
          </div>
        </form>
      </AnimatedShow>
    </>
  );
}
