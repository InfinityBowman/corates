import { createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import PasswordInput from './PasswordInput.jsx';
import ErrorMessage from './ErrorMessage.jsx';
import { PrimaryButton, AuthLink } from './AuthButtons.jsx';

export default function SignIn() {
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const navigate = useNavigate();
  const { signin, authError } = useBetterAuth();

  // Watch for auth errors from the store
  const displayError = () => error() || authError();

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

      // Handle specific error types
      if (
        err.message?.includes('Email not verified') ||
        err.message?.includes('email_verified_at is null')
      ) {
        navigate('/verify-email', { replace: true });
      } else if (
        err.message?.includes('Invalid credentials') ||
        err.message?.includes('Incorrect email or password')
      ) {
        setError('Incorrect email or password');
      } else if (err.message?.includes('User not found')) {
        setError('No account found with this email');
      } else if (err.message?.includes('Too many requests')) {
        setError('Too many sign-in attempts. Please try again later.');
      } else {
        setError(err.message || 'Sign in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class='h-full bg-blue-50 flex items-center justify-center px-4 py-8 sm:py-12'>
      <form
        aria-labelledby='signin-heading'
        onSubmit={handleSubmit}
        class='w-full max-w-md sm:max-w-xl bg-white rounded-xl sm:rounded-3xl shadow-2xl p-6 sm:p-12 space-y-4 border border-gray-100'
        autocomplete='off'
      >
        <div class='mb-2 sm:mb-4 text-center'>
          <h2 class='text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2' id='signin-heading'>
            Welcome Back
          </h2>
          <p class='text-gray-500 text-xs sm:text-sm'>Sign in to your account.</p>
        </div>

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

        <div class='text-center mt-1 sm:mt-2'>
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
      </form>
    </div>
  );
}
