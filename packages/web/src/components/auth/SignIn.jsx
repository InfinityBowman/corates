import { createSignal, onCleanup, onMount, Show } from 'solid-js';
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

export default function SignIn() {
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [googleLoading, setGoogleLoading] = createSignal(false);
  const [orcidLoading, setOrcidLoading] = createSignal(false);
  const [useMagicLink, setUseMagicLink] = createSignal(false);
  const [showTwoFactor, setShowTwoFactor] = createSignal(false);
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
      // Mark as OAuth signup in case this is a new user who needs to complete profile
      localStorage.setItem('oauthSignup', 'true');
      // Redirect to complete-profile which will check if profile is complete
      await signinWithOrcid('/complete-profile');
    } catch (err) {
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
    <div class='flex h-full items-center justify-center bg-blue-50 px-4 py-8 sm:py-12'>
      <div class='relative w-full max-w-md space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-12'>
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
              class='mb-1 text-xl font-bold text-gray-900 sm:mb-2 sm:text-2xl'
              id='signin-heading'
            >
              Welcome Back
            </h2>
            <p class='text-xs text-gray-500 sm:text-sm'>Sign in to your account.</p>
          </div>

          <LastLoginHint />

          {/* Toggle between password and magic link */}
          <div class='flex rounded-lg bg-gray-100 p-1'>
            <button
              type='button'
              onClick={() => setUseMagicLink(false)}
              class={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
                !useMagicLink() ?
                  'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Password
            </button>
            <button
              type='button'
              onClick={() => setUseMagicLink(true)}
              class={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
                useMagicLink() ?
                  'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Email Link
            </button>
          </div>

          {/* Magic Link Form */}
          <Show when={useMagicLink()}>
            <MagicLinkForm callbackPath='/complete-profile' />
          </Show>

          {/* Password Form */}
          <Show when={!useMagicLink()}>
            <form aria-labelledby='signin-heading' onSubmit={handleSubmit} autocomplete='off'>
              <div class='space-y-4'>
                <div>
                  <label
                    class='mb-1 block text-xs font-semibold text-gray-700 sm:mb-2 sm:text-sm'
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
                    class='w-full rounded-lg border border-gray-300 py-2 pr-3 pl-3 text-xs transition focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none sm:pr-4 sm:pl-4 sm:text-sm'
                    required
                    id='email-input'
                    placeholder='you@example.com'
                    disabled={loading()}
                  />
                </div>

                <div>
                  <PasswordInput autoComplete='current-password' disabled={loading()} required>
                    <PasswordInputControl>
                      <PasswordInputField
                        value={password()}
                        onInput={e => setPassword(e.target.value)}
                        placeholder='Password'
                      />
                      <PasswordInputVisibilityTrigger />
                    </PasswordInputControl>
                  </PasswordInput>
                </div>

                <ErrorMessage displayError={displayError} />

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
          </Show>

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

          <div class='mt-2 text-center text-xs text-gray-500 sm:mt-4 sm:text-sm'>
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
    </div>
  );
}
