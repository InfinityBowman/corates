import { useState, useEffect, useCallback } from 'react';
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/authStore';
import { handleError } from '@/lib/error-utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  PasswordInput,
  PasswordInputControl,
  PasswordInputField,
  PasswordInputVisibilityTrigger,
} from '@/components/ui/password-input';
import { ErrorMessage } from '@/components/auth/ErrorMessage';
import { PrimaryButton, AuthLink } from '@/components/auth/AuthButtons';
import { StrengthIndicator } from '@/components/auth/StrengthIndicator';

const REDIRECT_DELAY_MS = 3000;

export const Route = createFileRoute('/_auth/reset-password')({
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || '',
  }),
});

function ResetPasswordPage() {
  const { token } = useSearch({ from: '/_auth/reset-password' });

  return (
    <div className='border-border bg-card relative flex w-full max-w-md flex-col gap-4 rounded-xl border p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-12'>
      <a href='/' className='absolute top-4 left-4 sm:top-6 sm:left-6'>
        <img src='/logo.svg' alt='CoRATES' className='h-6 w-auto sm:h-7' />
      </a>

      {token ?
        <SetNewPasswordForm token={token} />
      : <RequestResetForm />}
    </div>
  );
}

function RequestResetForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const resetPassword = useAuthStore(s => s.resetPassword);
  const setAuthError = useAuthStore(s => s.setAuthError);
  const authError = useAuthStore(s => s.authError);

  useEffect(() => {
    setAuthError(null);
  }, [setAuthError]);

  // Redirect to signin after success with cleanup
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => navigate({ to: '/signin' }), REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [success, navigate]);

  const displayError = error || authError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err) {
      await handleError(err, { setError, showToast: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className='mb-2 text-center sm:mb-4'>
        <h2 className='text-foreground mb-1 text-xl font-bold sm:mb-2 sm:text-2xl'>
          Reset Password
        </h2>
        <p className='text-muted-foreground text-xs sm:text-sm'>
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      {success && (
        <Alert variant='success' className='animate-in fade-in text-center duration-200'>
          <div>
            <AlertTitle>Reset Email Sent!</AlertTitle>
            <AlertDescription>
              Check your email for instructions to reset your password. Redirecting you to sign
              in...
            </AlertDescription>
          </div>
        </Alert>
      )}

      {!success && (
        <form
          onSubmit={handleSubmit}
          className='animate-in fade-in flex flex-col gap-4 duration-200'
        >
          <div>
            <label
              className='text-secondary-foreground mb-1 block text-xs font-semibold sm:mb-2 sm:text-sm'
              htmlFor='email-input'
            >
              Email Address
            </label>
            <input
              type='email'
              autoComplete='email'
              autoCapitalize='off'
              spellCheck='false'
              value={email}
              onChange={e => setEmail(e.target.value)}
              className='border-border focus:ring-primary w-full rounded-lg border py-2 pr-3 pl-3 text-xs transition focus:border-transparent focus:ring-2 focus:outline-none sm:pr-4 sm:pl-4 sm:text-sm'
              required
              id='email-input'
              placeholder='you@example.com'
              disabled={loading}
            />
          </div>

          <ErrorMessage error={displayError} />

          <PrimaryButton loading={loading} loadingText='Sending Email...'>
            Send Reset Email
          </PrimaryButton>

          <div className='text-muted-foreground mt-2 text-center text-xs sm:mt-4 sm:text-sm'>
            Remember your password?{' '}
            <AuthLink
              href='/signin'
              onClick={e => {
                e.preventDefault();
                navigate({ to: '/signin' });
              }}
            >
              Sign In
            </AuthLink>
          </div>
        </form>
      )}
    </>
  );
}

function SetNewPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [unmetRequirements, setUnmetRequirements] = useState<string[]>([]);
  const navigate = useNavigate();
  const confirmPasswordReset = useAuthStore(s => s.confirmPasswordReset);
  const setAuthError = useAuthStore(s => s.setAuthError);
  const authError = useAuthStore(s => s.authError);

  useEffect(() => {
    setAuthError(null);
  }, [setAuthError]);

  // Redirect to signin after success with cleanup
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => navigate({ to: '/signin' }), REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [success, navigate]);

  const displayError = error || authError;

  const handleUnmet = useCallback((errors: string[]) => {
    setUnmetRequirements(errors);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Please enter a new password');
      return;
    }

    if (unmetRequirements.length > 0) {
      setError(`Password must have ${unmetRequirements.join(', ')}`);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await confirmPasswordReset(token, password);
      setSuccess(true);
    } catch (err) {
      await handleError(err, { setError, showToast: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className='mb-2 text-center sm:mb-4'>
        <h2 className='text-foreground mb-1 text-xl font-bold sm:mb-2 sm:text-2xl'>
          Set New Password
        </h2>
        <p className='text-muted-foreground text-xs sm:text-sm'>Enter your new password below.</p>
      </div>

      {success && (
        <Alert variant='success' className='animate-in fade-in text-center duration-200'>
          <div>
            <AlertTitle>Password Reset Successfully!</AlertTitle>
            <AlertDescription>
              Your password has been updated. Redirecting you to sign in...
            </AlertDescription>
          </div>
        </Alert>
      )}

      {!success && (
        <form
          onSubmit={handleSubmit}
          className='animate-in fade-in flex flex-col gap-4 duration-200'
        >
          <div>
            <label
              className='text-secondary-foreground mb-1 block text-xs font-semibold sm:mb-2 sm:text-sm'
              htmlFor='new-password-input'
            >
              New Password
            </label>
            <PasswordInput autoComplete='new-password' disabled={loading} required>
              <PasswordInputControl>
                <PasswordInputField
                  id='new-password-input'
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  placeholder='Enter new password'
                  aria-describedby={displayError ? 'reset-password-error' : undefined}
                />
                <PasswordInputVisibilityTrigger />
              </PasswordInputControl>
            </PasswordInput>
            <StrengthIndicator password={password} onUnmet={handleUnmet} />
          </div>

          <div>
            <label
              className='text-secondary-foreground mb-1 block text-xs font-semibold sm:mb-2 sm:text-sm'
              htmlFor='confirm-password-input'
            >
              Confirm Password
            </label>
            <PasswordInput autoComplete='new-password' disabled={loading} required>
              <PasswordInputControl>
                <PasswordInputField
                  id='confirm-password-input'
                  value={confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setConfirmPassword(e.target.value)
                  }
                  placeholder='Confirm new password'
                  aria-describedby={displayError ? 'reset-password-error' : undefined}
                />
                <PasswordInputVisibilityTrigger />
              </PasswordInputControl>
            </PasswordInput>
          </div>

          <ErrorMessage error={displayError} id='reset-password-error' />

          <PrimaryButton loading={loading} loadingText='Setting Password...'>
            Set Password
          </PrimaryButton>

          <div className='text-muted-foreground mt-2 text-center text-xs sm:mt-4 sm:text-sm'>
            <AuthLink
              href='/reset-password'
              onClick={e => {
                e.preventDefault();
                navigate({ to: '/reset-password', search: { token: '' } });
              }}
            >
              Request a new reset link
            </AuthLink>
          </div>
        </form>
      )}
    </>
  );
}
