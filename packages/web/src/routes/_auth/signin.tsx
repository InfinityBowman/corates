import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { useAuthStore } from '@/stores/authStore';
import { handleError } from '@/lib/error-utils';
import { getPendingInvitationToken, setPendingInvitationToken } from '@/lib/pendingInvitation';
import { clientLogger } from '@/lib/clientLogger';
import { useOAuthError } from '@/hooks/useOAuthError';
import { useBfcacheReset } from '@/hooks/useBfcacheReset';
import { getLastLoginMethod, LOGIN_METHODS } from '@/lib/lastLoginMethod';
import { USER_ERRORS, normalizeError } from '@corates/shared';
import { PasswordInput } from '@/components/ui/password-input';
import { Input } from '@/components/ui/input';
import { ErrorMessage } from '@/components/auth/ErrorMessage';
import { PrimaryButton, AuthLink } from '@/components/auth/AuthButtons';
import { Button } from '@/components/ui/button';
import {
  GoogleButton,
  OrcidButton,
  SocialAuthContainer,
  AuthDivider,
} from '@/components/auth/SocialAuthButtons';
import { EmailCodeForm } from '@/components/auth/EmailCodeForm';
import { TwoFactorVerify } from '@/components/auth/TwoFactorVerify';
import { LastLoginHint } from '@/components/auth/LastLoginHint';

const signinSearch = z.object({
  error: z.string().optional().catch(undefined),
});

// Social providers run with disableImplicitSignUp, so an unknown identity on
// this page comes back with this code instead of a silently created account
const SIGNUP_DISABLED_CODE = 'SIGNUP_DISABLED';

const SOCIAL_IDENTITIES: Record<string, { label: string; logo: string }> = {
  [LOGIN_METHODS.GOOGLE]: { label: 'Google account', logo: '/logos/google.svg' },
  [LOGIN_METHODS.ORCID]: { label: 'ORCID iD', logo: '/logos/orcid.svg' },
};

export const Route = createFileRoute('/_auth/signin')({
  component: SignInPage,
  validateSearch: signinSearch,
});

function SignInPage() {
  useOAuthError();

  const { error: searchError } = Route.useSearch();
  const searchErrorCode = searchError?.toUpperCase().replace(/-/g, '_');
  // The redirect carries no provider, but the attempt saved its method before leaving
  const [blockedProvider] = useState(() =>
    searchErrorCode === SIGNUP_DISABLED_CODE ? getLastLoginMethod() : null,
  );
  const blockedIdentity = blockedProvider ? SOCIAL_IDENTITIES[blockedProvider] : null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [orcidLoading, setOrcidLoading] = useState(false);
  const [useEmailCode, setUseEmailCode] = useState(() => {
    const lastMethod = getLastLoginMethod();
    return !lastMethod || lastMethod === LOGIN_METHODS.EMAIL_CODE;
  });
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [formHeight, setFormHeight] = useState<string>('auto');

  const passwordFormRef = useRef<HTMLDivElement>(null);
  const emailCodeFormRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const signin = useAuthStore(s => s.signin);
  const signinWithGoogle = useAuthStore(s => s.signinWithGoogle);
  const signinWithOrcid = useAuthStore(s => s.signinWithOrcid);
  const setAuthError = useAuthStore(s => s.setAuthError);
  const authError = useAuthStore(s => s.authError);

  const socialProviderCount = 2;
  const displayError = error || authError;

  const resetSocialLoading = useCallback(() => {
    setGoogleLoading(false);
    setOrcidLoading(false);
  }, []);

  // Clear stale auth errors and capture a pending invitation token on mount
  useEffect(() => {
    setAuthError(null);

    const urlParams = new URLSearchParams(window.location.search);
    const invitationToken = urlParams.get('invitation');
    if (invitationToken) {
      setPendingInvitationToken(invitationToken);
    }
  }, [setAuthError]);

  // Reset social loading states when page is restored from bfcache
  useBfcacheReset(resetSocialLoading);

  // Measure the active panel before paint and track content-driven height
  // changes (the code form swapping steps) so the clipped container never cuts off
  useLayoutEffect(() => {
    const activeEl = useEmailCode ? emailCodeFormRef.current : passwordFormRef.current;
    if (!activeEl) return;

    const measure = () => setFormHeight(`${activeEl.offsetHeight}px`);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(activeEl);
    return () => observer.disconnect();
  }, [useEmailCode, displayError]);

  async function handleGoogleSignIn(requestSignUp = false) {
    setGoogleLoading(true);
    setError('');
    try {
      localStorage.setItem('oauthSignup', 'true');
      await signinWithGoogle('/complete-profile', { requestSignUp });
    } catch (err) {
      console.error('Google sign-in error:', err);
      clientLogger.info('client.auth.sign_in_failed', {
        provider: 'google',
        code: normalizeError(err).code,
      });
      setError('Failed to sign in with Google. Please try again.');
      localStorage.removeItem('oauthSignup');
      setGoogleLoading(false);
    }
  }

  async function handleOrcidSignIn(requestSignUp = false) {
    setOrcidLoading(true);
    setError('');
    try {
      localStorage.setItem('oauthSignup', 'true');
      await signinWithOrcid('/complete-profile', { requestSignUp });
    } catch (err) {
      console.error('ORCID sign-in error:', err);
      clientLogger.info('client.auth.sign_in_failed', {
        provider: 'orcid',
        code: normalizeError(err).code,
      });
      setError('Failed to sign in with ORCID. Please try again.');
      localStorage.removeItem('oauthSignup');
      setOrcidLoading(false);
    }
  }

  function handleCreateAccount() {
    if (blockedProvider === LOGIN_METHODS.GOOGLE) return handleGoogleSignIn(true);
    if (blockedProvider === LOGIN_METHODS.ORCID) return handleOrcidSignIn(true);
    return navigate({ to: '/signup' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);

    try {
      const result = await signin(email, password);

      if (result && typeof result === 'object' && 'twoFactorRequired' in result) {
        setShowTwoFactor(true);
        setLoading(false);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // Resume a pending project invitation instead of landing on the dashboard
      const pendingInvitation = getPendingInvitationToken();
      if (pendingInvitation) {
        navigate({ to: '/invite/$token', params: { token: pendingInvitation }, replace: true });
        return;
      }

      navigate({ to: '/dashboard', replace: true });
    } catch (err) {
      const code = normalizeError(err).code;
      clientLogger.info('client.auth.sign_in_failed', { provider: 'password', code });
      if (code === USER_ERRORS.EMAIL_NOT_VERIFIED.code) {
        navigate({ to: '/verify-email', search: { email }, replace: true });
        return;
      }
      await handleError(err, { setError, showToast: false, navigate });
    } finally {
      setLoading(false);
    }
  }

  function handleTwoFactorCancel() {
    setShowTwoFactor(false);
    setPassword('');
    setError('');
  }

  return (
    <div className='border-border bg-card relative flex w-full max-w-md flex-col gap-4 rounded-xl border p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-12'>
      <a href='/' className='absolute top-4 left-4 sm:top-6 sm:left-6'>
        <img src='/logo.svg' alt='CoRATES' className='h-6 w-auto sm:h-7' />
      </a>

      {showTwoFactor ?
        <TwoFactorVerify onCancel={handleTwoFactorCancel} />
      : <>
          <div className='mb-2 text-center sm:mb-4'>
            <h1
              className='text-foreground mb-1 text-xl font-bold sm:mb-2 sm:text-2xl'
              id='signin-heading'
            >
              Welcome Back
            </h1>
            <p className='text-muted-foreground text-xs sm:text-sm'>Sign in to your account.</p>
          </div>

          <LastLoginHint />

          {blockedIdentity && (
            <div
              role='status'
              className='border-border flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center'
            >
              <img
                src={blockedIdentity.logo}
                alt=''
                aria-hidden='true'
                className='size-4 shrink-0 self-start sm:self-center'
              />
              <div className='flex-1 space-y-0.5'>
                <p className='text-foreground text-sm font-medium'>
                  No account uses this {blockedIdentity.label}
                </p>
                <p className='text-muted-foreground text-xs'>
                  Use the sign-in method for your existing account. You can connect your{' '}
                  {blockedIdentity.label} later in Settings.
                </p>
              </div>
              <Button
                size='sm'
                onClick={handleCreateAccount}
                disabled={googleLoading || orcidLoading}
                className='shrink-0 self-start sm:self-center'
              >
                Create account
              </Button>
            </div>
          )}

          {/* Tab switcher */}
          <div
            className='bg-secondary relative flex rounded-lg p-1'
            role='tablist'
            aria-label='Sign in method'
            onKeyDown={e => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const goToEmailCode = e.key === 'ArrowRight';
                setUseEmailCode(goToEmailCode);
                document.getElementById(goToEmailCode ? 'tab-email-code' : 'tab-password')?.focus();
              }
            }}
          >
            {/* Sliding indicator */}
            <div
              aria-hidden='true'
              className='bg-card absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-md shadow-sm transition-transform duration-300'
              style={{
                transform: useEmailCode ? 'translateX(100%)' : 'translateX(0)',
                transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
            <button
              type='button'
              role='tab'
              id='tab-password'
              tabIndex={useEmailCode ? -1 : 0}
              aria-selected={!useEmailCode}
              aria-controls='panel-password'
              onClick={() => setUseEmailCode(false)}
              className={`relative z-10 flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors duration-300 sm:text-sm ${
                !useEmailCode ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Password
            </button>
            <button
              type='button'
              role='tab'
              id='tab-email-code'
              tabIndex={useEmailCode ? 0 : -1}
              aria-selected={useEmailCode}
              aria-controls='panel-email-code'
              onClick={() => setUseEmailCode(true)}
              className={`relative z-10 flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors duration-300 sm:text-sm ${
                useEmailCode ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Email Code
            </button>
          </div>

          {/* Sliding form container */}
          <div
            className='overflow-hidden rounded-lg transition-[height] duration-300'
            style={{
              height: formHeight,
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <div
              className='flex w-[200%] items-start transition-transform duration-300'
              style={{
                transform: useEmailCode ? 'translateX(-50%)' : 'translateX(0)',
                transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {/* Password Form */}
              <div
                ref={passwordFormRef}
                id='panel-password'
                role='tabpanel'
                aria-labelledby='tab-password'
                aria-hidden={useEmailCode}
                inert={useEmailCode ? true : undefined}
                className='bg-card w-1/2 shrink-0 px-1'
              >
                <form aria-labelledby='signin-heading' onSubmit={handleSubmit} autoComplete='off'>
                  <div className='flex flex-col gap-4'>
                    <div>
                      <label
                        className='text-secondary-foreground mb-1 block text-xs font-semibold sm:mb-2 sm:text-sm'
                        htmlFor='email-input'
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
                        id='email-input'
                        placeholder='you@example.com'
                        disabled={loading}
                        aria-describedby={displayError ? 'signin-error' : undefined}
                      />
                    </div>

                    <div>
                      <label
                        className='text-secondary-foreground mb-1 block text-xs font-semibold sm:mb-2 sm:text-sm'
                        htmlFor='password-input'
                      >
                        Password
                      </label>
                      <PasswordInput
                        id='password-input'
                        autoComplete='current-password'
                        disabled={loading}
                        required
                        value={password}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setPassword(e.target.value)
                        }
                        placeholder='Password'
                        aria-describedby={displayError ? 'signin-error' : undefined}
                      />
                    </div>

                    <ErrorMessage error={displayError} id='signin-error' />

                    <PrimaryButton loading={loading} loadingText='Signing In...'>
                      Sign In
                    </PrimaryButton>

                    <div className='text-center'>
                      <AuthLink
                        href='/reset-password'
                        onClick={e => {
                          e.preventDefault();
                          navigate({ to: '/reset-password', search: { email } });
                        }}
                      >
                        <span className='text-xs sm:text-sm'>Forgot password?</span>
                      </AuthLink>
                    </div>
                  </div>
                </form>
              </div>

              {/* Email code form */}
              <div
                ref={emailCodeFormRef}
                id='panel-email-code'
                role='tabpanel'
                aria-labelledby='tab-email-code'
                aria-hidden={!useEmailCode}
                inert={!useEmailCode ? true : undefined}
                className='bg-card w-1/2 shrink-0 px-1'
              >
                <EmailCodeForm callbackPath='/complete-profile' />
              </div>
            </div>
          </div>

          <AuthDivider />

          <SocialAuthContainer buttonCount={socialProviderCount}>
            <GoogleButton
              loading={googleLoading}
              onClick={() => handleGoogleSignIn()}
              iconOnly={socialProviderCount > 1}
            />
            <OrcidButton
              loading={orcidLoading}
              onClick={() => handleOrcidSignIn()}
              iconOnly={socialProviderCount > 1}
            />
          </SocialAuthContainer>

          <div className='text-muted-foreground mt-2 text-center text-xs sm:mt-4 sm:text-sm'>
            Don&apos;t have an account?{' '}
            <AuthLink
              href='/signup'
              onClick={e => {
                e.preventDefault();
                navigate({ to: '/signup' });
              }}
            >
              Sign Up
            </AuthLink>
          </div>
        </>
      }
    </div>
  );
}
