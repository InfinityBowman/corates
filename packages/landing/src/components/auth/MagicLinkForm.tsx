/**
 * Magic link email form - shared between SignIn and SignUp pages
 * Handles send, resend with cooldown, and success state
 */

import { useState, useCallback } from 'react';
import { MailIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { handleError } from '@/lib/error-utils';
import { Alert } from '@/components/ui/alert';
import { ErrorMessage } from './ErrorMessage';
import { PrimaryButton } from './AuthButtons';

const RESEND_COOLDOWN_MS = 30000;

interface MagicLinkFormProps {
  initialEmail?: string;
  callbackPath?: string;
  buttonText?: string;
  description?: string;
}

export function MagicLinkForm({
  initialEmail = '',
  callbackPath = '/complete-profile',
  buttonText = 'Send Sign-In Link',
  description = "We'll email you a magic link for password-free sign in.",
}: MagicLinkFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState('');
  const signinWithMagicLink = useAuthStore(s => s.signinWithMagicLink);
  const authError = useAuthStore(s => s.authError);

  const displayError = error || authError;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (!email) {
        setError('Please enter your email address');
        return;
      }

      setLoading(true);

      try {
        localStorage.setItem('pendingName', email);
        await signinWithMagicLink(email, callbackPath);
        setSent(true);
        setCanResend(false);
        setTimeout(() => setCanResend(true), RESEND_COOLDOWN_MS);
      } catch (err) {
        await handleError(err, { setError, showToast: false });
      } finally {
        setLoading(false);
      }
    },
    [email, callbackPath, signinWithMagicLink],
  );

  function handleReset() {
    setSent(false);
    setEmail('');
    setError('');
    setResent(false);
    setCanResend(false);
  }

  async function handleResend() {
    if (!canResend || resending) return;

    setResending(true);
    setError('');

    try {
      await signinWithMagicLink(email, callbackPath);
      setResent(true);
      setCanResend(false);
      setTimeout(() => {
        setCanResend(true);
        setResent(false);
      }, RESEND_COOLDOWN_MS);
    } catch (err) {
      await handleError(err, { setError, showToast: false });
      setCanResend(true);
    } finally {
      setResending(false);
    }
  }

  if (sent) {
    return (
      <div className='flex flex-col gap-4'>
        <div className='py-4 text-center'>
          <div className='mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-green-100'>
            <MailIcon className='size-7 text-green-600' />
          </div>
          <h3 className='text-foreground mb-1 text-base font-semibold'>Check your email</h3>
          <p className='text-muted-foreground mb-3 text-sm'>
            We sent a sign-in link to <strong className='text-foreground'>{email}</strong>
          </p>
          <p className='text-muted-foreground mb-4 text-xs'>
            Click the link in the email to sign in. The link expires in 10 minutes.
          </p>

          <ErrorMessage error={displayError} id='magic-link-resend-error' />

          {resent && (
            <Alert variant='success' className='mb-4 text-xs sm:text-sm'>
              Email sent successfully!
            </Alert>
          )}

          <div className='flex flex-col gap-2'>
            <button
              type='button'
              onClick={handleResend}
              disabled={!canResend || resending}
              className={`text-sm font-medium transition ${
                canResend && !resending ?
                  'text-primary hover:text-primary/80 cursor-pointer'
                : 'text-muted-foreground/70 cursor-not-allowed'
              }`}
            >
              {resending ?
                'Sending...'
              : canResend ?
                "Didn't receive it? Try again"
              : 'Try again in 30s'}
            </button>
            <button
              type='button'
              onClick={handleReset}
              className='text-muted-foreground hover:text-secondary-foreground text-sm font-medium'
            >
              Use a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      <form onSubmit={handleSubmit} autoComplete='off'>
        <div className='flex flex-col gap-4'>
          <div>
            <label
              className='text-secondary-foreground mb-1 block text-xs font-semibold sm:mb-2 sm:text-sm'
              htmlFor='magic-link-email'
            >
              Email
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
              id='magic-link-email'
              placeholder='you@example.com'
              disabled={loading}
              aria-describedby={displayError ? 'magic-link-error' : undefined}
            />
          </div>

          <ErrorMessage error={displayError} id='magic-link-error' />

          <PrimaryButton loading={loading} loadingText='Sending Link...'>
            {buttonText}
          </PrimaryButton>

          <p className='text-muted-foreground text-center text-xs'>{description}</p>
        </div>
      </form>
    </div>
  );
}
