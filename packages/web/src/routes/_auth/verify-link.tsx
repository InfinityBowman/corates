/**
 * Magic link interstitial. Mail scanners prefetch links and would burn the
 * single-use token, so emails land here and verification requires a click.
 */

import { useState } from 'react';
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { z } from 'zod';
import { MailIcon } from 'lucide-react';
import { API_BASE, BASEPATH } from '@/config/api';
import { PrimaryButton, AuthLink } from '@/components/auth/AuthButtons';

const verifyLinkSearch = z.object({
  token: z.string().catch(''),
  callbackURL: z.string().catch(''),
});

export const Route = createFileRoute('/_auth/verify-link')({
  component: VerifyLinkPage,
  validateSearch: verifyLinkSearch,
});

function VerifyLinkPage() {
  const { token, callbackURL } = useSearch({ from: '/_auth/verify-link' });
  const [verifying, setVerifying] = useState(false);
  const navigate = useNavigate();

  function handleContinue() {
    setVerifying(true);

    const base = (BASEPATH || '').replace(/\/$/, '');
    const origin = window.location.origin;

    const verifyUrl = new URL('/api/auth/magic-link/verify', API_BASE);
    verifyUrl.searchParams.set('token', token);
    verifyUrl.searchParams.set('callbackURL', callbackURL || `${origin}${base}/dashboard`);
    // Failed tokens redirect to signin, which explains and offers a fresh link
    verifyUrl.searchParams.set('errorCallbackURL', `${origin}${base}/signin`);

    window.location.assign(verifyUrl.toString());
  }

  return (
    <div className='border-border bg-card relative flex w-full max-w-md flex-col gap-4 rounded-xl border p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-12'>
      <a href='/' className='absolute top-4 left-4 sm:top-6 sm:left-6'>
        <img src='/logo.svg' alt='CoRATES' className='h-6 w-auto sm:h-7' />
      </a>

      <div className='py-4 text-center'>
        <div className='bg-success-bg mx-auto mb-4 flex size-14 items-center justify-center rounded-full'>
          <MailIcon className='text-success size-7' />
        </div>

        {token ?
          <>
            <h1 className='text-foreground mb-2 text-xl font-bold sm:text-2xl'>
              Sign in to CoRATES
            </h1>
            <p className='text-muted-foreground mb-6 text-sm'>
              Click below to finish signing in with your email link.
            </p>
            <PrimaryButton
              type='button'
              loading={verifying}
              loadingText='Signing you in...'
              onClick={handleContinue}
            >
              Continue to CoRATES
            </PrimaryButton>
          </>
        : <>
            <h1 className='text-foreground mb-2 text-xl font-bold sm:text-2xl'>
              This link is incomplete
            </h1>
            <p className='text-muted-foreground mb-6 text-sm'>
              The sign-in link is missing its token. Your email client may have altered it - request
              a new link to continue.
            </p>
            <AuthLink
              href='/signin'
              onClick={e => {
                e.preventDefault();
                navigate({ to: '/signin' });
              }}
            >
              Request a new sign-in link
            </AuthLink>
          </>
        }
      </div>
    </div>
  );
}
