import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/authStore';
import { handleError } from '@/lib/error-utils.js';
import { useOAuthError } from '@/hooks/useOAuthError';
import { useBfcacheReset } from '@/hooks/useBfcacheReset';
import {
  PasswordInput,
  PasswordInputControl,
  PasswordInputField,
  PasswordInputVisibilityTrigger,
} from '@/components/ui/password-input';
import { ErrorMessage } from '@/components/auth/ErrorMessage';
import { PrimaryButton, AuthLink } from '@/components/auth/AuthButtons';
import {
  GoogleButton,
  OrcidButton,
  SocialAuthContainer,
  AuthDivider,
} from '@/components/auth/SocialAuthButtons';
import { MagicLinkForm } from '@/components/auth/MagicLinkForm';
import { TwoFactorVerify } from '@/components/auth/TwoFactorVerify';
import { LastLoginHint } from '@/components/auth/LastLoginHint';

export const Route = createFileRoute('/_auth/signin')({
  component: SignInPage,
});

function SignInPage() {
  useOAuthError();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [orcidLoading, setOrcidLoading] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [formHeight, setFormHeight] = useState<string>('auto');

  const passwordFormRef = useRef<HTMLDivElement>(null);
  const magicLinkFormRef = useRef<HTMLDivElement>(null);

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

  // Clear stale auth errors on mount
  useEffect(() => { setAuthError(null); }, [setAuthError]);

  // Reset social loading states when page is restored from bfcache
  useBfcacheReset(resetSocialLoading);

  // Measure form height synchronously before paint to prevent flicker
  const updateFormHeight = useCallback(() => {
    const activeRef = useMagicLink ? magicLinkFormRef.current : passwordFormRef.current;
    if (activeRef) {
      setFormHeight(`${activeRef.offsetHeight}px`);
    }
  }, [useMagicLink]);

  useLayoutEffect(() => {
    updateFormHeight();
  }, [updateFormHeight]);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError('');
    try {
      localStorage.setItem('oauthSignup', 'true');
      await signinWithGoogle('/complete-profile');
    } catch (err) {
      console.error('Google sign-in error:', err);
      setError('Failed to sign in with Google. Please try again.');
      localStorage.removeItem('oauthSignup');
      setGoogleLoading(false);
    }
  }

  async function handleOrcidSignIn() {
    setOrcidLoading(true);
    setError('');
    try {
      localStorage.setItem('oauthSignup', 'true');
      await signinWithOrcid('/complete-profile');
    } catch (err) {
      console.error('ORCID sign-in error:', err);
      setError('Failed to sign in with ORCID. Please try again.');
      localStorage.removeItem('oauthSignup');
      setOrcidLoading(false);
    }
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

      if ((result as any)?.twoFactorRequired) {
        setShowTwoFactor(true);
        setLoading(false);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 200));
      navigate({ to: '/dashboard', replace: true });
    } catch (err) {
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
    <div className="relative w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-12">
      <a href="/" className="absolute left-4 top-4 sm:left-6 sm:top-6">
        <img src="/logo.svg" alt="CoRATES" className="h-6 w-auto sm:h-7" />
      </a>

      {showTwoFactor ? (
        <TwoFactorVerify onCancel={handleTwoFactorCancel} />
      ) : (
        <>
          <div className="mb-2 text-center sm:mb-4">
            <h2 className="mb-1 text-xl font-bold text-foreground sm:mb-2 sm:text-2xl" id="signin-heading">
              Welcome Back
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">Sign in to your account.</p>
          </div>

          <LastLoginHint />

          {/* Tab switcher */}
          <div
            className="relative flex rounded-lg bg-secondary p-1"
            role="tablist"
            aria-label="Sign in method"
            onKeyDown={e => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const goToMagicLink = e.key === 'ArrowRight';
                setUseMagicLink(goToMagicLink);
                document.getElementById(goToMagicLink ? 'tab-magic-link' : 'tab-password')?.focus();
              }
            }}
          >
            {/* Sliding indicator */}
            <div
              aria-hidden="true"
              className="absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-md bg-card shadow-sm transition-transform duration-300"
              style={{
                transform: useMagicLink ? 'translateX(100%)' : 'translateX(0)',
                transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
            <button
              type="button"
              role="tab"
              id="tab-password"
              tabIndex={useMagicLink ? -1 : 0}
              aria-selected={!useMagicLink}
              aria-controls="panel-password"
              onClick={() => setUseMagicLink(false)}
              className={`relative z-10 flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors duration-300 sm:text-sm ${
                !useMagicLink ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Password
            </button>
            <button
              type="button"
              role="tab"
              id="tab-magic-link"
              tabIndex={useMagicLink ? 0 : -1}
              aria-selected={useMagicLink}
              aria-controls="panel-magic-link"
              onClick={() => setUseMagicLink(true)}
              className={`relative z-10 flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors duration-300 sm:text-sm ${
                useMagicLink ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Email Link
            </button>
          </div>

          {/* Sliding form container */}
          <div
            className="overflow-hidden rounded-lg transition-[height] duration-300"
            style={{
              height: formHeight,
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <div
              className="flex w-[200%] items-start transition-transform duration-300"
              style={{
                transform: useMagicLink ? 'translateX(-50%)' : 'translateX(0)',
                transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {/* Password Form */}
              <div
                ref={passwordFormRef}
                id="panel-password"
                role="tabpanel"
                aria-labelledby="tab-password"
                aria-hidden={useMagicLink}
                inert={useMagicLink ? true : undefined}
                className="w-1/2 shrink-0 bg-card px-1"
              >
                <form aria-labelledby="signin-heading" onSubmit={handleSubmit} autoComplete="off">
                  <div className="space-y-4">
                    <div>
                      <label
                        className="mb-1 block text-xs font-semibold text-secondary-foreground sm:mb-2 sm:text-sm"
                        htmlFor="email-input"
                      >
                        Email
                      </label>
                      <input
                        type="email"
                        autoComplete="email"
                        autoCapitalize="off"
                        spellCheck="false"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full rounded-lg border border-border py-2 pl-3 pr-3 text-xs transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary sm:pl-4 sm:pr-4 sm:text-sm"
                        required
                        id="email-input"
                        placeholder="you@example.com"
                        disabled={loading}
                        aria-describedby={displayError ? 'signin-error' : undefined}
                      />
                    </div>

                    <div>
                      <label
                        className="mb-1 block text-xs font-semibold text-secondary-foreground sm:mb-2 sm:text-sm"
                        htmlFor="password-input"
                      >
                        Password
                      </label>
                      <PasswordInput autoComplete="current-password" disabled={loading} required>
                        <PasswordInputControl>
                          <PasswordInputField
                            id="password-input"
                            value={password}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                            placeholder="Password"
                            aria-describedby={displayError ? 'signin-error' : undefined}
                          />
                          <PasswordInputVisibilityTrigger />
                        </PasswordInputControl>
                      </PasswordInput>
                    </div>

                    <ErrorMessage error={displayError} id="signin-error" />

                    <PrimaryButton loading={loading} loadingText="Signing In...">
                      Sign In
                    </PrimaryButton>

                    <div className="text-center">
                      <AuthLink
                        href="/reset-password"
                        onClick={e => {
                          e.preventDefault();
                          navigate({ to: '/reset-password', search: { token: '' } });
                        }}
                      >
                        <span className="text-xs sm:text-sm">Forgot password?</span>
                      </AuthLink>
                    </div>
                  </div>
                </form>
              </div>

              {/* Magic Link Form */}
              <div
                ref={magicLinkFormRef}
                id="panel-magic-link"
                role="tabpanel"
                aria-labelledby="tab-magic-link"
                aria-hidden={!useMagicLink}
                inert={!useMagicLink ? true : undefined}
                className="w-1/2 shrink-0 bg-card px-1"
              >
                <MagicLinkForm callbackPath="/complete-profile" />
              </div>
            </div>
          </div>

          <AuthDivider />

          <SocialAuthContainer buttonCount={socialProviderCount}>
            <GoogleButton loading={googleLoading} onClick={handleGoogleSignIn} iconOnly={socialProviderCount > 1} />
            <OrcidButton loading={orcidLoading} onClick={handleOrcidSignIn} iconOnly={socialProviderCount > 1} />
          </SocialAuthContainer>

          <div className="mt-2 text-center text-xs text-muted-foreground sm:mt-4 sm:text-sm">
            Don&apos;t have an account?{' '}
            <AuthLink
              href="/signup"
              onClick={e => {
                e.preventDefault();
                navigate({ to: '/signup' });
              }}
            >
              Sign Up
            </AuthLink>
          </div>
        </>
      )}
    </div>
  );
}
