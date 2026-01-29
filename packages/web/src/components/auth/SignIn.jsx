import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import {
  PasswordInput,
  PasswordInputControl,
  PasswordInputField,
  PasswordInputVisibilityTrigger,
} from '@/components/ui/password-input';
import ErrorMessage from './ErrorMessage.jsx';
import { PrimaryButton, AuthLink } from './AuthButtons.jsx';
import {
  GoogleButton,
  OrcidButton,
  SocialAuthContainer,
  AuthDivider,
} from './SocialAuthButtons.jsx';
import MagicLinkForm from './MagicLinkForm.jsx';
import TwoFactorVerify from './TwoFactorVerify.jsx';
import LastLoginHint from './LastLoginHint.jsx';
import { handleError } from '@/lib/error-utils.js';
import { useOAuthError } from '@/primitives/useOAuthError.js';

export default function SignIn() {
  // Handle OAuth errors from URL params (e.g., ?error=state_mismatch)
  useOAuthError();

  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [googleLoading, setGoogleLoading] = createSignal(false);
  const [orcidLoading, setOrcidLoading] = createSignal(false);
  const [useMagicLink, setUseMagicLink] = createSignal(false);
  const [showTwoFactor, setShowTwoFactor] = createSignal(false);
  const [formHeight, setFormHeight] = createSignal('auto');
  let passwordFormRef;
  let magicLinkFormRef;
  const navigate = useNavigate();
  const { signin, signinWithGoogle, signinWithOrcid, authError, clearAuthError } = useBetterAuth();

  // Number of social providers
  const socialProviderCount = 2;

  function resetSocialLoading() {
    setGoogleLoading(false);
    setOrcidLoading(false);
  }

  // Clear any stale auth errors when component mounts
  onMount(() => {
    clearAuthError();
    resetSocialLoading();

    // If the user clicks OAuth and then uses browser Back,
    // the page can be restored from bfcache with stale state.
    const handleReturn = () => resetSocialLoading();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') resetSocialLoading();
    };

    window.addEventListener('pageshow', handleReturn);
    window.addEventListener('focus', handleReturn);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    onCleanup(() => {
      window.removeEventListener('pageshow', handleReturn);
      window.removeEventListener('focus', handleReturn);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    });
  });

  // Update form height based on which form is active
  const updateFormHeight = () => {
    const activeRef = useMagicLink() ? magicLinkFormRef : passwordFormRef;
    if (activeRef) {
      setFormHeight(`${activeRef.offsetHeight}px`);
    }
  };

  // Set initial height after mount when refs are ready
  onMount(() => {
    // Small delay to ensure refs are measured after initial render
    requestAnimationFrame(updateFormHeight);
  });

  // Update height when switching forms
  createEffect(() => {
    // Track the signal
    useMagicLink();
    // Update after a frame to ensure layout is complete
    requestAnimationFrame(updateFormHeight);
  });

  // Watch for auth errors from the store
  const displayError = () => error() || authError();

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError('');

    try {
      // Mark as OAuth signup in case this is a new user who needs to complete profile
      localStorage.setItem('oauthSignup', 'true');
      // Redirect to complete-profile which will check if profile is complete
      // and redirect to dashboard if so
      // OAuth provider errors are handled by useOAuthError hook via errorCallbackURL redirect
      await signinWithGoogle('/complete-profile');
    } catch (err) {
      // This catches immediate errors (network failure before redirect), not OAuth provider errors
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
      // Mark as OAuth signup in case this is a new user who needs to complete profile
      localStorage.setItem('oauthSignup', 'true');
      // Redirect to complete-profile which will check if profile is complete
      // OAuth provider errors are handled by useOAuthError hook via errorCallbackURL redirect
      await signinWithOrcid('/complete-profile');
    } catch (err) {
      // This catches immediate errors (network failure before redirect), not OAuth provider errors
      console.error('ORCID sign-in error:', err);
      setError('Failed to sign in with ORCID. Please try again.');
      localStorage.removeItem('oauthSignup');
      setOrcidLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email() || !password()) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);

    try {
      const result = await signin(email(), password());

      // Check if 2FA is required
      if (result?.twoFactorRequired) {
        setShowTwoFactor(true);
        setLoading(false);
        return;
      }

      // Small delay for better UX
      await new Promise(resolve => setTimeout(resolve, 200));

      // Navigate to dashboard on success
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Sign in error:', err);

      // Use centralized error handling
      await handleError(err, {
        setError,
        showToast: false, // Don't show toast, use inline error message
        navigate,
      });
    } finally {
      setLoading(false);
    }
  }

  // Handle cancel from 2FA screen
  function handleTwoFactorCancel() {
    setShowTwoFactor(false);
    setPassword('');
    setError('');
  }

  return (
    <div class='border-border-subtle bg-card relative w-full max-w-md space-y-4 rounded-xl border p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-12'>
      {/* Logo */}
      <a href='/' class='absolute top-4 left-4 sm:top-6 sm:left-6'>
        <img src='/logo.svg' alt='CoRATES' class='h-6 w-auto sm:h-7' />
      </a>

      {/* Two-Factor Verification */}
      <Show when={showTwoFactor()}>
        <TwoFactorVerify onCancel={handleTwoFactorCancel} />
      </Show>

      {/* Normal Sign In */}
      <Show when={!showTwoFactor()}>
        <div class='mb-2 text-center sm:mb-4'>
          <h2
            class='text-foreground mb-1 text-xl font-bold sm:mb-2 sm:text-2xl'
            id='signin-heading'
          >
            Welcome Back
          </h2>
          <p class='text-muted-foreground text-xs sm:text-sm'>Sign in to your account.</p>
        </div>

        <LastLoginHint />

        {/* Toggle between password and magic link */}
        <div
          class='bg-secondary relative flex rounded-lg p-1'
          role='tablist'
          aria-label='Sign in method'
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
            aria-hidden='true'
            class='bg-card absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-md shadow-sm transition-transform duration-300'
            style={{
              transform: useMagicLink() ? 'translateX(100%)' : 'translateX(0)',
              'transition-timing-function': 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
          <button
            type='button'
            role='tab'
            id='tab-password'
            tabIndex={useMagicLink() ? -1 : 0}
            aria-selected={!useMagicLink()}
            aria-controls='panel-password'
            onClick={() => setUseMagicLink(false)}
            class={`relative z-10 flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors duration-300 sm:text-sm ${
              !useMagicLink() ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Password
          </button>
          <button
            type='button'
            role='tab'
            id='tab-magic-link'
            tabIndex={useMagicLink() ? 0 : -1}
            aria-selected={useMagicLink()}
            aria-controls='panel-magic-link'
            onClick={() => setUseMagicLink(true)}
            class={`relative z-10 flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors duration-300 sm:text-sm ${
              useMagicLink() ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Email Link
          </button>
        </div>

        {/* Sliding form container */}
        <div
          class='overflow-hidden rounded-lg transition-[height] duration-300'
          style={{
            height: formHeight(),
            'transition-timing-function': 'cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <div
            class='flex w-[200%] items-start transition-transform duration-300'
            style={{
              transform: useMagicLink() ? 'translateX(-50%)' : 'translateX(0)',
              'transition-timing-function': 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {/* Password Form */}
            <div
              ref={passwordFormRef}
              id='panel-password'
              role='tabpanel'
              aria-labelledby='tab-password'
              aria-hidden={useMagicLink()}
              inert={useMagicLink()}
              class='bg-card w-1/2 shrink-0 px-1'
            >
              <form aria-labelledby='signin-heading' onSubmit={handleSubmit} autocomplete='off'>
                <div class='space-y-4'>
                  <div>
                    <label
                      class='text-secondary-foreground mb-1 block text-xs font-semibold sm:mb-2 sm:text-sm'
                      for='email-input'
                    >
                      Email
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
                      aria-describedby={displayError() ? 'signin-error' : undefined}
                    />
                  </div>

                  <div>
                    <label
                      class='text-secondary-foreground mb-1 block text-xs font-semibold sm:mb-2 sm:text-sm'
                      for='password-input'
                    >
                      Password
                    </label>
                    <PasswordInput autoComplete='current-password' disabled={loading()} required>
                      <PasswordInputControl>
                        <PasswordInputField
                          id='password-input'
                          value={password()}
                          onInput={e => setPassword(e.target.value)}
                          placeholder='Password'
                          aria-describedby={displayError() ? 'signin-error' : undefined}
                        />
                        <PasswordInputVisibilityTrigger />
                      </PasswordInputControl>
                    </PasswordInput>
                  </div>

                  <ErrorMessage displayError={displayError} id='signin-error' />

                  <PrimaryButton loading={loading()} loadingText='Signing In...'>
                    Sign In
                  </PrimaryButton>

                  <div class='text-center'>
                    <AuthLink
                      href='/reset-password'
                      onClick={e => {
                        e.preventDefault();
                        navigate('/reset-password');
                      }}
                    >
                      <span class='text-xs sm:text-sm'>Forgot password?</span>
                    </AuthLink>
                  </div>
                </div>
              </form>
            </div>

            {/* Magic Link Form */}
            <div
              ref={magicLinkFormRef}
              id='panel-magic-link'
              role='tabpanel'
              aria-labelledby='tab-magic-link'
              aria-hidden={!useMagicLink()}
              inert={!useMagicLink()}
              class='bg-card w-1/2 shrink-0 px-1'
            >
              <MagicLinkForm callbackPath='/complete-profile' />
            </div>
          </div>
        </div>

        <AuthDivider />

        <SocialAuthContainer buttonCount={socialProviderCount}>
          <GoogleButton
            loading={googleLoading()}
            onClick={handleGoogleSignIn}
            iconOnly={socialProviderCount > 1}
          />
          <OrcidButton
            loading={orcidLoading()}
            onClick={handleOrcidSignIn}
            iconOnly={socialProviderCount > 1}
          />
        </SocialAuthContainer>

        <div class='text-muted-foreground mt-2 text-center text-xs sm:mt-4 sm:text-sm'>
          Don&apos;t have an account?{' '}
          <AuthLink
            href='/signup'
            onClick={e => {
              e.preventDefault();
              navigate('/signup');
            }}
          >
            Sign Up
          </AuthLink>
        </div>
      </Show>
    </div>
  );
}
