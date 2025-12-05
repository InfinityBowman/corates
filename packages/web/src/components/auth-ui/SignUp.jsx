import { createSignal, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import ErrorMessage from './ErrorMessage.jsx';
import { PrimaryButton, AuthLink } from './AuthButtons.jsx';
import {
  GoogleButton,
  OrcidButton,
  SocialAuthContainer,
  AuthDivider,
} from './SocialAuthButtons.jsx';

/**
 * Sign Up page - minimal friction, just email or social providers
 * After signup: email users go to check-email, OAuth users go to complete-profile
 */
export default function SignUp() {
  const [email, setEmail] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [googleLoading, setGoogleLoading] = createSignal(false);
  const [orcidLoading, setOrcidLoading] = createSignal(false);

  const navigate = useNavigate();
  const { signup, signinWithGoogle, signinWithOrcid, authError, clearAuthError } = useBetterAuth();

  // Number of social providers (update as you add more)
  const socialProviderCount = 2;

  onMount(() => clearAuthError());

  const displayError = () => error() || authError();

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

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email().trim()) {
      setError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email())) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      // Sign up with just email - password will be set in complete-profile
      // Using a temporary password that will be changed
      const tempPassword = crypto.randomUUID() + 'Aa1!';
      await signup(email(), tempPassword, email().split('@')[0]);

      await new Promise(resolve => setTimeout(resolve, 200));
      navigate(`/check-email?email=${encodeURIComponent(email())}`, { replace: true });
    } catch (err) {
      console.error('Signup error:', err);
      const msg = err.message?.toLowerCase() || '';

      if (msg.includes('user already exists') || msg.includes('email already in use')) {
        setError('An account with this email already exists. Try signing in instead.');
      } else if (msg.includes('invalid email')) {
        setError('Please enter a valid email address');
      } else if (msg.includes('too many requests')) {
        setError('Too many attempts. Please try again later.');
      } else if (msg.includes('failed to fetch') || msg.includes('network')) {
        setError('Unable to connect. Please check your connection.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
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

        {/* Email signup form */}
        <form onSubmit={handleSubmit} class='space-y-4' autocomplete='off'>
          <div>
            <label
              class='block text-xs sm:text-sm font-semibold text-gray-700 mb-1'
              for='email-input'
            >
              Email Address
            </label>
            <input
              type='email'
              autoComplete='email'
              autocapitalize='off'
              spellCheck='false'
              value={email()}
              onInput={e => setEmail(e.target.value)}
              class='w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition'
              required
              id='email-input'
              placeholder='you@example.com'
            />
          </div>

          <ErrorMessage displayError={displayError} />

          <PrimaryButton loading={loading()} loadingText='Continuing...'>
            Continue with Email
          </PrimaryButton>
        </form>

        <AuthDivider />

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

        <p class='text-center text-xs text-gray-400 mt-4'>
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
