import { useState, useEffect, useCallback } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/authStore';
import { handleError } from '@/lib/error-utils';
import { useOAuthError } from '@/hooks/useOAuthError';
import { useBfcacheReset } from '@/hooks/useBfcacheReset';
import { capturePlanParams } from '@/lib/plan-redirect-utils';
import { ErrorMessage } from '@/components/auth/ErrorMessage';
import { AuthLink } from '@/components/auth/AuthButtons';
import {
  GoogleButton,
  OrcidButton,
  SocialAuthContainer,
  AuthDivider,
} from '@/components/auth/SocialAuthButtons';
import { MagicLinkForm } from '@/components/auth/MagicLinkForm';

export const Route = createFileRoute('/_auth/signup')({
  component: SignUpPage,
});

function SignUpPage() {
  useOAuthError();

  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [orcidLoading, setOrcidLoading] = useState(false);

  const navigate = useNavigate();
  const signinWithGoogle = useAuthStore(s => s.signinWithGoogle);
  const signinWithOrcid = useAuthStore(s => s.signinWithOrcid);
  const setAuthError = useAuthStore(s => s.setAuthError);
  const authError = useAuthStore(s => s.authError);

  const displayError = error || authError;
  const socialProviderCount = 2;

  const resetSocialLoading = useCallback(() => {
    setGoogleLoading(false);
    setOrcidLoading(false);
  }, []);

  // Clear auth errors and capture URL params on mount
  useEffect(() => {
    setAuthError(null);

    const urlParams = new URLSearchParams(window.location.search);
    const invitationToken = urlParams.get('invitation');
    if (invitationToken) {
      localStorage.setItem('pendingInvitationToken', invitationToken);
    }
    capturePlanParams(urlParams);
  }, [setAuthError]);

  // Reset social loading states when page is restored from bfcache
  useBfcacheReset(resetSocialLoading);

  async function handleGoogleSignUp() {
    setGoogleLoading(true);
    setError('');
    try {
      localStorage.setItem('oauthSignup', 'true');
      await signinWithGoogle('/complete-profile');
    } catch (err) {
      await handleError(err, { setError, showToast: false });
      localStorage.removeItem('oauthSignup');
      setGoogleLoading(false);
    }
  }

  async function handleOrcidSignUp() {
    setOrcidLoading(true);
    setError('');
    try {
      localStorage.setItem('oauthSignup', 'true');
      await signinWithOrcid('/complete-profile');
    } catch (err) {
      await handleError(err, { setError, showToast: false });
      localStorage.removeItem('oauthSignup');
      setOrcidLoading(false);
    }
  }

  return (
    <div className='border-border bg-card relative w-full max-w-md rounded-xl border p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-12'>
      <a href='/' className='absolute top-4 left-4 sm:top-6 sm:left-6'>
        <img src='/logo.svg' alt='CoRATES' className='h-6 w-auto sm:h-7' />
      </a>

      <div className='mb-4 text-center sm:mb-6'>
        <h1 className='text-foreground mb-1 text-xl font-bold sm:mb-2 sm:text-2xl' id='signup-heading'>
          Create an Account
        </h1>
        <p className='text-muted-foreground text-xs sm:text-sm'>Get started with CoRATES</p>
      </div>

      <SocialAuthContainer buttonCount={socialProviderCount}>
        <GoogleButton
          loading={googleLoading}
          onClick={handleGoogleSignUp}
          iconOnly={socialProviderCount > 1}
        />
        <OrcidButton
          loading={orcidLoading}
          onClick={handleOrcidSignUp}
          iconOnly={socialProviderCount > 1}
        />
      </SocialAuthContainer>

      <AuthDivider />

      <ErrorMessage error={displayError} id='signup-error' />

      <MagicLinkForm
        callbackPath='/complete-profile'
        buttonText='Continue with Email'
        description="We'll send you a link to create your account - no password needed."
      />

      <p className='text-muted-foreground/70 mt-6 text-center text-xs'>
        By continuing, you agree to our{' '}
        <a href='/terms' className='text-primary hover:underline'>
          Terms of Service
        </a>{' '}
        and{' '}
        <a href='/privacy' className='text-primary hover:underline'>
          Privacy Policy
        </a>
        .
      </p>

      <div className='border-border text-muted-foreground mt-4 border-t pt-4 text-center text-xs sm:text-sm'>
        Already have an account?{' '}
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
    </div>
  );
}
