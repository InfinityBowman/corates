/**
 * Email verification for password accounts. The sign-in attempt already sent
 * a code; a correct code verifies the address and signs the user in.
 */

import { useState } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { useAuthStore } from '@/stores/authStore';
import { handleError } from '@/lib/error-utils';
import { ErrorMessage } from '@/components/auth/ErrorMessage';
import { PrimaryButton, AuthLink } from '@/components/auth/AuthButtons';
import { CodeInput, ResendCode } from '@/components/auth/CodeInput';

const verifyEmailSearch = z.object({
  email: z.string().catch(''),
});

export const Route = createFileRoute('/_auth/verify-email')({
  validateSearch: verifyEmailSearch,
  beforeLoad: ({ search }) => {
    if (!search.email) throw redirect({ to: '/signin' });
  },
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { email } = Route.useSearch();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const verifyEmailWithCode = useAuthStore(s => s.verifyEmailWithCode);
  const sendVerificationCode = useAuthStore(s => s.sendVerificationCode);

  async function handleVerify(submitted = code) {
    if (loading) return;
    setError('');
    if (submitted.length !== 6) {
      setError('Enter the six-digit code from your email');
      return;
    }
    setLoading(true);
    try {
      await verifyEmailWithCode(email, submitted);
      navigate({ to: '/complete-profile', replace: true });
    } catch (err) {
      setCode('');
      await handleError(err, { setError, showToast: false });
      setLoading(false);
    }
  }

  return (
    <div className='border-border bg-card relative flex w-full max-w-md flex-col gap-4 rounded-xl border p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-12'>
      <a href='/' className='absolute top-4 left-4 sm:top-6 sm:left-6'>
        <img src='/logo.svg' alt='CoRATES' className='h-6 w-auto sm:h-7' />
      </a>

      <div className='mb-2 text-center sm:mb-4'>
        <h1 className='text-foreground mb-1 text-xl font-bold sm:mb-2 sm:text-2xl'>
          Confirm your email
        </h1>
        <p className='text-muted-foreground text-xs sm:text-sm'>
          We sent a six-digit code to <strong className='text-foreground'>{email}</strong>
        </p>
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          handleVerify();
        }}
        className='flex flex-col gap-4'
      >
        <CodeInput
          id='verify-email-code'
          value={code}
          onChange={setCode}
          onComplete={handleVerify}
          disabled={loading}
        />
        <ErrorMessage error={error} id='verify-email-error' />
        <PrimaryButton loading={loading} loadingText='Verifying...'>
          Confirm
        </PrimaryButton>
        <ResendCode onResend={() => sendVerificationCode(email)} />
      </form>

      <div className='text-muted-foreground text-center text-xs sm:text-sm'>
        <AuthLink
          href='/signin'
          onClick={e => {
            e.preventDefault();
            navigate({ to: '/signin' });
          }}
        >
          Back to sign in
        </AuthLink>
      </div>
    </div>
  );
}
