import { createSignal, onCleanup, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import { AuthLink } from './AuthButtons.jsx';
import ErrorMessage from './ErrorMessage.jsx';
import {
  GoogleButton,
  OrcidButton,
  SocialAuthContainer,
  AuthDivider,
} from './SocialAuthButtons.jsx';
import MagicLinkForm from './MagicLinkForm.jsx';
import { LANDING_URL } from '@config/api.js';
import { handleError } from '@/lib/error-utils.js';

/**
 * Sign Up page - minimal friction with magic link or social providers
 * After signup: users go to complete-profile to set name and role
 */
export default function SignUp() {
  const [error, setError] = createSignal('');
  const [googleLoading, setGoogleLoading] = createSignal(false);
  const [orcidLoading, setOrcidLoading] = createSignal(false);

  const navigate = useNavigate();
  const { signinWithGoogle, signinWithOrcid, clearAuthError, authError } = useBetterAuth();

  // Combine local error with auth error for consistent display
  const displayError = () => error() || authError();

  // Number of social providers (update as you add more)
  const socialProviderCount = 2;

  function resetSocialLoading() {
    setGoogleLoading(false);
    setOrcidLoading(false);
  }

  onMount(() => {
    clearAuthError();
    resetSocialLoading();

    // Note: Invitation tokens are now handled via magic link callback URLs
    // The token is passed directly to /complete-profile?invitation=TOKEN
    // This code is kept for backwards compatibility if users land on /signup?invitation=TOKEN
    const urlParams = new URLSearchParams(window.location.search);
    const invitationToken = urlParams.get('invitation');
    if (invitationToken) {
      localStorage.setItem('pendingInvitationToken', invitationToken);
    }

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

  async function handleGoogleSignUp() {
    setGoogleLoading(true);
    setError('');

    try {
      // Mark this as an OAuth signup so complete-profile knows not to ask for password
      localStorage.setItem('oauthSignup', 'true');
      // OAuth users will be redirected to complete-profile after auth
      await signinWithGoogle('/complete-profile');
    } catch (err) {
      console.error('Google sign-up error:', err);
      await handleError(err, {
        setError,
        showToast: false,
      });
      localStorage.removeItem('oauthSignup');
      setGoogleLoading(false);
    }
  }

  async function handleOrcidSignUp() {
    setOrcidLoading(true);
    setError('');

    try {
      // Mark this as an OAuth signup so complete-profile knows not to ask for password
      localStorage.setItem('oauthSignup', 'true');
      // OAuth users will be redirected to complete-profile after auth
      await signinWithOrcid('/complete-profile');
    } catch (err) {
      console.error('ORCID sign-up error:', err);
      await handleError(err, {
        setError,
        showToast: false,
      });
      localStorage.removeItem('oauthSignup');
      setOrcidLoading(false);
    }
  }

  return (
    <div class='border-border-subtle bg-card relative w-full max-w-md rounded-xl border p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-12'>
      {/* Logo */}
      <a href='/' class='absolute top-4 left-4 sm:top-6 sm:left-6'>
        <img src='/logo.svg' alt='CoRATES' class='h-6 w-auto sm:h-7' />
      </a>

      <div class='mb-4 text-center sm:mb-6'>
        <h2 class='text-foreground mb-1 text-xl font-bold sm:mb-2 sm:text-2xl'>
          Create an Account
        </h2>
        <p class='text-muted-foreground text-xs sm:text-sm'>Get started with CoRATES</p>
      </div>

      {/* Social providers */}
      <SocialAuthContainer buttonCount={socialProviderCount}>
        <GoogleButton
          loading={googleLoading()}
          onClick={handleGoogleSignUp}
          iconOnly={socialProviderCount > 1}
        />
        <OrcidButton
          loading={orcidLoading()}
          onClick={handleOrcidSignUp}
          iconOnly={socialProviderCount > 1}
        />
      </SocialAuthContainer>

      <AuthDivider />

      <ErrorMessage displayError={displayError} id='signup-error' />

      {/* Magic Link Form - simple email signup */}
      <MagicLinkForm
        callbackPath='/complete-profile'
        buttonText='Continue with Email'
        description="We'll send you a link to create your account - no password needed."
      />

      <p class='text-muted-foreground/70 mt-6 text-center text-xs'>
        By continuing, you agree to our{' '}
        <a
          href={`${LANDING_URL}/terms`}
          target='_blank'
          class='text-blue-500 hover:underline'
          rel='noopener noreferrer'
        >
          Terms of Service
        </a>{' '}
        and{' '}
        <a
          href={`${LANDING_URL}/privacy`}
          target='_blank'
          rel='noopener noreferrer'
          class='text-blue-500 hover:underline'
        >
          Privacy Policy
        </a>
        .
      </p>

      <div class='border-border-subtle text-muted-foreground mt-4 border-t pt-4 text-center text-xs sm:text-sm'>
        Already have an account?{' '}
        <AuthLink
          href='/signin'
          onClick={e => {
            e.preventDefault();
            navigate('/signin');
          }}
        >
          Sign In
        </AuthLink>
      </div>
    </div>
  );
}
