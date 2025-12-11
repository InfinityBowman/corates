import { createSignal, onMount } from 'solid-js';
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

/**
 * Sign Up page - minimal friction with magic link or social providers
 * After signup: users go to complete-profile to set name and role
 */
export default function SignUp() {
  const [error, setError] = createSignal('');
  const [googleLoading, setGoogleLoading] = createSignal(false);
  const [orcidLoading, setOrcidLoading] = createSignal(false);

  const navigate = useNavigate();
  const { signinWithGoogle, signinWithOrcid, clearAuthError } = useBetterAuth();

  // Number of social providers (update as you add more)
  const socialProviderCount = 2;

  onMount(() => clearAuthError());

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
      setError('Failed to sign up with Google. Please try again.');
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
      setError('Failed to sign up with ORCID. Please try again.');
      localStorage.removeItem('oauthSignup');
      setOrcidLoading(false);
    }
  }

  return (
    <div class='h-full bg-blue-50 flex items-center justify-center px-4 py-8 sm:py-12'>
      <div class='w-full max-w-md sm:max-w-xl bg-white rounded-xl sm:rounded-3xl shadow-2xl p-6 sm:p-12 border border-gray-100'>
        <div class='text-center mb-4 sm:mb-6'>
          <h2 class='text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2'>
            Create an Account
          </h2>
          <p class='text-gray-500 text-xs sm:text-sm'>Get started with CoRATES</p>
        </div>

        {/* Social providers first - most common */}
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

        <ErrorMessage displayError={error} />

        {/* Magic Link Form - simple email signup */}
        <MagicLinkForm
          callbackPath='/complete-profile'
          buttonText='Continue with Email'
          description="We'll send you a link to create your account - no password needed."
        />

        <p class='text-center text-xs text-gray-400 mt-6'>
          By continuing, you agree to our{' '}
          <a
            href='https://corates.org/terms'
            target='_blank'
            rel='noopener noreferrer'
            class='text-blue-500 hover:underline'
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            href='https://corates.org/privacy'
            target='_blank'
            rel='noopener noreferrer'
            class='text-blue-500 hover:underline'
          >
            Privacy Policy
          </a>
          .
        </p>

        <div class='text-center text-xs sm:text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100'>
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
    </div>
  );
}
