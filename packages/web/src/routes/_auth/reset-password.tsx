import { useState, useEffect, useCallback } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { useAuthStore } from '@/stores/authStore';
import { handleError } from '@/lib/error-utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { PasswordInput } from '@/components/ui/password-input';
import { Input } from '@/components/ui/input';
import { ErrorMessage } from '@/components/auth/ErrorMessage';
import { PrimaryButton, AuthLink } from '@/components/auth/AuthButtons';
import { StrengthIndicator } from '@/components/auth/StrengthIndicator';
import { CodeInput, ResendCode } from '@/components/auth/CodeInput';

const REDIRECT_DELAY_MS = 3000;

// Settings lands here with the code already sent when a user sets a first password
const resetPasswordSearch = z.object({
  email: z.string().catch(''),
  sent: z.string().optional().catch(undefined),
});

export const Route = createFileRoute('/_auth/reset-password')({
  component: ResetPasswordPage,
  validateSearch: resetPasswordSearch,
});

function ResetPasswordPage() {
  const search = Route.useSearch();
  const [email, setEmail] = useState(search.sent === '1' ? search.email : '');

  return (
    <div className='border-border bg-card relative flex w-full max-w-md flex-col gap-4 rounded-xl border p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-12'>
      <a href='/' className='absolute top-4 left-4 sm:top-6 sm:left-6'>
        <img src='/logo.svg' alt='CoRATES' className='h-6 w-auto sm:h-7' />
      </a>

      {email ?
        <SetNewPasswordForm email={email} onChangeEmail={() => setEmail('')} />
      : <RequestResetForm initialEmail={search.email} onSent={setEmail} />}
    </div>
  );
}

function RequestResetForm({
  initialEmail,
  onSent,
}: {
  initialEmail: string;
  onSent: (email: string) => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const requestPasswordResetCode = useAuthStore(s => s.requestPasswordResetCode);
  const setAuthError = useAuthStore(s => s.setAuthError);
  const authError = useAuthStore(s => s.authError);

  useEffect(() => {
    setAuthError(null);
  }, [setAuthError]);

  const displayError = error || authError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      await requestPasswordResetCode(email);
      onSent(email);
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
          Enter your email address and we&apos;ll send you a code to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className='animate-in fade-in flex flex-col gap-4 duration-200'>
        <div>
          <label
            className='text-secondary-foreground mb-1 block text-xs font-semibold sm:mb-2 sm:text-sm'
            htmlFor='email-input'
          >
            Email Address
          </label>
          <Input
            type='email'
            autoComplete='email'
            autoCapitalize='off'
            spellCheck='false'
            value={email}
            onChange={e => setEmail(e.target.value)}
            className='h-auto py-2 text-sm'
            required
            id='email-input'
            placeholder='you@example.com'
            disabled={loading}
          />
        </div>

        <ErrorMessage error={displayError} />

        <PrimaryButton loading={loading} loadingText='Sending Code...'>
          Send Reset Code
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
    </>
  );
}

function SetNewPasswordForm({
  email,
  onChangeEmail,
}: {
  email: string;
  onChangeEmail: () => void;
}) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [unmetRequirements, setUnmetRequirements] = useState<string[]>([]);
  const navigate = useNavigate();
  const resetPasswordWithCode = useAuthStore(s => s.resetPasswordWithCode);
  const requestPasswordResetCode = useAuthStore(s => s.requestPasswordResetCode);
  const setAuthError = useAuthStore(s => s.setAuthError);
  const authError = useAuthStore(s => s.authError);

  useEffect(() => {
    setAuthError(null);
  }, [setAuthError]);

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
    if (code.length !== 6) {
      setError('Enter the six-digit code from your email');
      return;
    }
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
      await resetPasswordWithCode(email, code, password);
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
        <p className='text-muted-foreground text-xs sm:text-sm'>
          Enter the code we sent to <strong className='text-foreground'>{email}</strong> and choose
          a new password.
        </p>
      </div>

      {success && (
        <Alert variant='success' className='animate-in fade-in text-center duration-200'>
          <div>
            <AlertTitle>Password Updated</AlertTitle>
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
          <CodeInput id='reset-code-input' value={code} onChange={setCode} disabled={loading} />

          <div>
            <label
              className='text-secondary-foreground mb-1 block text-xs font-semibold sm:mb-2 sm:text-sm'
              htmlFor='new-password-input'
            >
              New Password
            </label>
            <PasswordInput
              id='new-password-input'
              autoComplete='new-password'
              disabled={loading}
              required
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              placeholder='Enter new password'
              aria-describedby={displayError ? 'reset-password-error' : undefined}
            />
            <StrengthIndicator password={password} onUnmet={handleUnmet} />
          </div>

          <div>
            <label
              className='text-secondary-foreground mb-1 block text-xs font-semibold sm:mb-2 sm:text-sm'
              htmlFor='confirm-password-input'
            >
              Confirm Password
            </label>
            <PasswordInput
              id='confirm-password-input'
              autoComplete='new-password'
              disabled={loading}
              required
              value={confirmPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setConfirmPassword(e.target.value)
              }
              placeholder='Confirm new password'
              aria-describedby={displayError ? 'reset-password-error' : undefined}
            />
          </div>

          <ErrorMessage error={displayError} id='reset-password-error' />

          <PrimaryButton loading={loading} loadingText='Setting Password...'>
            Set Password
          </PrimaryButton>

          <ResendCode
            onResend={() => requestPasswordResetCode(email)}
            onChangeEmail={onChangeEmail}
          />
        </form>
      )}
    </>
  );
}
