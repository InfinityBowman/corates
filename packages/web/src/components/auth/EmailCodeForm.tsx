/**
 * Email code sign-in shared by the sign-in and sign-up pages. A new address
 * becomes an account once its code checks out, so the two pages share a flow.
 */

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/authStore';
import { handleError } from '@/lib/error-utils';
import { Input } from '@/components/ui/input';
import { ErrorMessage } from './ErrorMessage';
import { PrimaryButton } from './AuthButtons';
import { CodeInput, ResendCode } from './CodeInput';

interface EmailCodeFormProps {
  callbackPath?: string;
  buttonText?: string;
  description?: string;
}

export function EmailCodeForm({
  callbackPath = '/complete-profile',
  buttonText = 'Send Code',
  description = 'We email you a six-digit code. No password needed.',
}: EmailCodeFormProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const sendSignInCode = useAuthStore(s => s.sendSignInCode);
  const signinWithEmailCode = useAuthStore(s => s.signinWithEmailCode);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      localStorage.setItem('pendingName', email);
      await sendSignInCode(email);
      setSent(true);
    } catch (err) {
      await handleError(err, { setError, showToast: false });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(submitted = code) {
    if (loading) return;
    setError('');
    if (submitted.length !== 6) {
      setError('Enter the six-digit code from your email');
      return;
    }
    setLoading(true);
    try {
      await signinWithEmailCode(email, submitted);
      navigate({ to: callbackPath, replace: true });
    } catch (err) {
      setCode('');
      await handleError(err, { setError, showToast: false });
      setLoading(false);
    }
  }

  function handleChangeEmail() {
    setSent(false);
    setCode('');
    setError('');
  }

  if (sent) {
    return (
      <form
        onSubmit={e => {
          e.preventDefault();
          handleVerify();
        }}
        className='flex flex-col gap-4'
      >
        <div className='text-center'>
          <h3 className='text-foreground mb-1 text-base font-semibold'>Enter your code</h3>
          <p className='text-muted-foreground text-sm'>
            We sent a six-digit code to <strong className='text-foreground'>{email}</strong>
          </p>
        </div>

        <CodeInput
          id='email-code-input'
          value={code}
          onChange={setCode}
          onComplete={handleVerify}
          disabled={loading}
        />

        <ErrorMessage error={error} id='email-code-error' />

        <PrimaryButton loading={loading} loadingText='Verifying...'>
          Continue
        </PrimaryButton>

        <ResendCode onResend={() => sendSignInCode(email)} onChangeEmail={handleChangeEmail} />
      </form>
    );
  }

  return (
    <form onSubmit={handleSend} autoComplete='off' className='flex flex-col gap-4'>
      <div>
        <label
          className='text-secondary-foreground mb-1 block text-xs font-semibold sm:mb-2 sm:text-sm'
          htmlFor='email-code-email'
        >
          Email
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
          id='email-code-email'
          placeholder='you@example.com'
          disabled={loading}
          aria-describedby={error ? 'email-code-error' : undefined}
        />
      </div>

      <ErrorMessage error={error} id='email-code-error' />

      <PrimaryButton loading={loading} loadingText='Sending Code...'>
        {buttonText}
      </PrimaryButton>

      <p className='text-muted-foreground text-center text-xs'>{description}</p>
    </form>
  );
}
