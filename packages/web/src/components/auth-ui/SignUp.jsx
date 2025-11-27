import { createSignal, createEffect } from 'solid-js';
import StrengthIndicator from './StrengthIndicator.jsx';
import PasswordInput from './PasswordInput.jsx';
import { useNavigate } from '@solidjs/router';
import { useBetterAuth } from '../../api/better-auth-store.js';
import { AnimatedShow } from '../AnimatedShow.jsx';
import { AiOutlineLoading3Quarters } from 'solid-icons/ai';

export default function SignUp() {
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [unmetRequirements, setUnmetRequirements] = createSignal([]);
  const [loading, setLoading] = createSignal(false);

  const navigate = useNavigate();
  const { signup, authError } = useBetterAuth();

  // Watch for auth errors from the store
  const displayError = () => error() || authError();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Validation
    if (!name() || !email() || !password() || !confirmPassword()) {
      setError('Please fill out all fields');
      return;
    }

    if (password() !== confirmPassword()) {
      setError('Passwords do not match');
      return;
    }

    if (unmetRequirements().length > 0) {
      setError(`Password must include ${unmetRequirements()[0]}`);
      return;
    }

    setLoading(true);

    try {
      await signup(email(), password(), name());

      // Small delay for better UX
      await new Promise(resolve => setTimeout(resolve, 200));

      // Navigate to check email page with email parameter
      navigate(`/check-email?email=${encodeURIComponent(email())}`, { replace: true });
    } catch (err) {
      console.error('Signup error:', err);

      // Handle specific error types
      if (
        err.message?.includes('User already exists') ||
        err.message?.includes('Email already in use')
      ) {
        setError('An account with this email already exists');
      } else if (err.message?.includes('Invalid email')) {
        setError('Please enter a valid email address');
      } else if (err.message?.includes('Password too weak')) {
        setError('Password is too weak. Please choose a stronger password.');
      } else if (err.message?.includes('Too many requests')) {
        setError('Too many registration attempts. Please try again later.');
      } else {
        setError(err.message || 'Sign up failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  createEffect(() => {
    if (password() === confirmPassword()) {
      setError('');
    }
  });

  return (
    <div class='h-full bg-blue-50 flex items-center justify-center px-4 py-6 sm:py-12'>
      <form
        aria-labelledby='signup-heading'
        onSubmit={handleSubmit}
        class='w-full max-w-md sm:max-w-xl bg-white rounded-xl sm:rounded-3xl shadow-2xl p-6 sm:p-12 space-y-4 border border-gray-100'
        autocomplete='off'
      >
        <div class='mb-2 text-center'>
          <h2 class='text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2' id='signup-heading'>
            Get Started
          </h2>
          <p class='text-gray-500 text-xs sm:text-sm'>Create a new account.</p>
        </div>
        <div>
          <label
            class='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
            for='name-input'
          >
            Name
          </label>
          <div class='relative'>
            <input
              type='text'
              autoComplete='name'
              autocapitalize='words'
              spellcheck='false'
              value={name()}
              onInput={e => setName(e.target.value)}
              class='w-full pl-3 sm:pl-4 pr-3 sm:pr-4 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition'
              required
              id='name-input'
              placeholder='What should we call you?'
            />
          </div>
        </div>
        <div>
          <label
            class='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
            for='email-input'
          >
            Email
          </label>
          <div class='relative'>
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
            />
          </div>
        </div>
        <div>
          <PasswordInput
            password={password()}
            onPasswordChange={setPassword}
            autoComplete='new-password'
            required
          />
          <ErrorMessage displayError={displayError} />

          <StrengthIndicator password={password()} onUnmet={setUnmetRequirements} />
        </div>
        <div>
          <label
            class='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
            for='confirm-password-input'
          >
            Confirm Password
          </label>
          <div class='relative'>
            <input
              type='password'
              autoComplete='new-password'
              autocapitalize='off'
              spellCheck='false'
              value={confirmPassword()}
              onInput={e => setConfirmPassword(e.target.value)}
              class='w-full pl-3 sm:pl-4 pr-3 sm:pr-4 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition big-placeholder'
              required
              id='confirm-password-input'
              placeholder='••••••••'
            />
          </div>
        </div>
        <button
          type='submit'
          class='w-full py-2 sm:py-3 text-sm sm:text-base bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg sm:rounded-xl shadow transition disabled:opacity-50 flex items-center justify-center'
          disabled={loading()}
        >
          <AnimatedShow when={loading()} fallback={'Sign Up'}>
            <div class='flex items-center'>
              <AiOutlineLoading3Quarters class='animate-spin mr-2' size={22} />
              Signing Up...
            </div>
          </AnimatedShow>
        </button>
        <div class='text-center text-xs sm:text-sm text-gray-500 mt-2 sm:mt-4'>
          Already have an account?{' '}
          <a
            href='/signin'
            class='text-blue-600 hover:underline font-semibold'
            onClick={e => {
              e.preventDefault();
              navigate('/signin');
            }}
          >
            Sign In
          </a>
        </div>
      </form>
    </div>
  );
}
