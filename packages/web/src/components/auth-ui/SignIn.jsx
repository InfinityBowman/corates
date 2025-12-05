import { createSignal, onMount, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import PasswordInput from '../zag/PasswordInput.jsx';
import ErrorMessage from './ErrorMessage.jsx';
import { PrimaryButton, AuthLink } from './AuthButtons.jsx';
import {
  GoogleButton,
  OrcidButton,
  SocialAuthContainer,
  AuthDivider,
} from './SocialAuthButtons.jsx';
import MagicLinkForm from './MagicLinkForm.jsx';

export default function SignIn() {
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [googleLoading, setGoogleLoading] = createSignal(false);
  const [orcidLoading, setOrcidLoading] = createSignal(false);
  const [useMagicLink, setUseMagicLink] = createSignal(false);
  const navigate = useNavigate();
  const { signin, signinWithGoogle, signinWithOrcid, authError, clearAuthError } = useBetterAuth();

  // Number of social providers
  const socialProviderCount = 2;

  // Clear any stale auth errors when component mounts
  onMount(() => clearAuthError());

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
      await signin(email(), password());

      // Small delay for better UX
      await new Promise(resolve => setTimeout(resolve, 200));

      // Navigate to dashboard on success
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Sign in error:', err);

      const msg = err.message?.toLowerCase() || '';

      // Handle specific error types
      if (msg.includes('email not verified') || msg.includes('email_verified_at is null')) {
        navigate('/verify-email', { replace: true });
      } else if (
        msg.includes('invalid credentials') ||
        msg.includes('incorrect email or password') ||
        msg.includes('invalid email or password')
      ) {
        setError('Incorrect email or password');
      } else if (
        msg.includes('user not found') ||
        msg.includes('user does not exist') ||
        msg.includes('no user found')
      ) {
        setError('No account found with this email');
      } else if (msg.includes('too many requests')) {
        setError('Too many sign-in attempts. Please try again later.');
      } else if (
        msg.includes('failed to fetch') ||
        msg.includes('load failed') ||
        msg.includes('network') ||
        msg.includes('cors')
      ) {
        setError(
          'Unable to connect to the server. Please check your internet connection and try again.',
        );
      } else if (msg.includes('timeout')) {
        setError('The request timed out. Please try again.');
      } else {
        // Catch-all for any unhandled errors - don't show raw error messages
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class='h-full bg-blue-50 flex items-center justify-center px-4 py-8 sm:py-12'>
      <div class='w-full max-w-md sm:max-w-xl bg-white rounded-xl sm:rounded-3xl shadow-2xl p-6 sm:p-12 space-y-4 border border-gray-100'>
        <div class='mb-2 sm:mb-4 text-center'>
          <h2 class='text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2' id='signin-heading'>
            Welcome Back
          </h2>
          <p class='text-gray-500 text-xs sm:text-sm'>Sign in to your account.</p>
        </div>

        {/* Toggle between password and magic link */}
        <div class='flex rounded-lg bg-gray-100 p-1'>
          <button
            type='button'
            onClick={() => setUseMagicLink(false)}
            class={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium rounded-md transition-colors ${
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
            class={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium rounded-md transition-colors ${
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
                  class='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
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
                  class='w-full pl-3 sm:pl-4 pr-3 sm:pr-4 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition'
                  required
                  id='email-input'
                  placeholder='you@example.com'
                  disabled={loading()}
                />
              </div>

              <div>
                <PasswordInput
                  password={password()}
                  onPasswordChange={setPassword}
                  autoComplete='current-password'
                  required
                  disabled={loading()}
                />
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

        <div class='text-center text-xs sm:text-sm text-gray-500 mt-2 sm:mt-4'>
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
      </div>
    </div>
  );
}
