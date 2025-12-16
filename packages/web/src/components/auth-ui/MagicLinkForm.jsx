import { createSignal, Show } from 'solid-js';
import { useBetterAuth } from '@api/better-auth-store.js';
import ErrorMessage from './ErrorMessage.jsx';
import { PrimaryButton } from './AuthButtons.jsx';
import { FiMail } from 'solid-icons/fi';

const RESEND_COOLDOWN_MS = 30000; // 30 seconds between resends

export default function MagicLinkForm(props) {
  const [email, setEmail] = createSignal(props.initialEmail || '');
  const [loading, setLoading] = createSignal(false);
  const [sent, setSent] = createSignal(false);
  const [resending, setResending] = createSignal(false);
  const [resent, setResent] = createSignal(false);
  const [canResend, setCanResend] = createSignal(false);
  const [error, setError] = createSignal('');
  const { signinWithMagicLink, authError } = useBetterAuth();

  const displayError = () => error() || authError();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email()) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      // Mark as magic link signup so CompleteProfile knows not to ask for password
      localStorage.setItem('magicLinkSignup', 'true');
      // Use email as the initial placeholder name for new users
      localStorage.setItem('pendingName', email());
      await signinWithMagicLink(email(), props.callbackPath || '/complete-profile');
      setSent(true);
      setCanResend(false);
      // Allow resending after cooldown
      setTimeout(() => setCanResend(true), RESEND_COOLDOWN_MS);
    } catch (err) {
      console.error('Magic link error:', err);
      const msg = err.message?.toLowerCase() || '';

      if (msg.includes('too many requests') || msg.includes('rate limit')) {
        setError('Too many requests. Please try again in a few minutes.');
      } else if (msg.includes('invalid email')) {
        setError('Please enter a valid email address.');
      } else {
        setError('Failed to send sign-in link. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setSent(false);
    setEmail('');
    setError('');
    setResent(false);
    setCanResend(false);
  }

  async function handleResend() {
    if (!canResend() || resending()) return;

    setResending(true);
    setError('');

    try {
      await signinWithMagicLink(email(), props.callbackPath || '/complete-profile');
      setResent(true);
      setCanResend(false);
      // Allow resending again after cooldown
      setTimeout(() => {
        setCanResend(true);
        setResent(false);
      }, RESEND_COOLDOWN_MS);
    } catch (err) {
      console.error('Resend magic link error:', err);
      const msg = err.message?.toLowerCase() || '';

      if (msg.includes('too many requests') || msg.includes('rate limit')) {
        setError('Too many requests. Please try again in a few minutes.');
      } else {
        setError('Failed to resend link. Please try again.');
      }
      setCanResend(true);
    } finally {
      setResending(false);
    }
  }

  return (
    <div class='space-y-4'>
      {/* Success State */}
      <Show when={sent()}>
        <div class='text-center py-4'>
          <div class='w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3'>
            <FiMail class='w-7 h-7 text-green-600' />
          </div>
          <h3 class='text-base font-semibold text-gray-900 mb-1'>Check your email</h3>
          <p class='text-gray-600 text-sm mb-3'>
            We sent a sign-in link to <strong class='text-gray-900'>{email()}</strong>
          </p>
          <p class='text-gray-500 text-xs mb-4'>
            Click the link in the email to sign in. The link expires in 10 minutes.
          </p>

          <ErrorMessage displayError={error} />

          <Show when={resent()}>
            <div class='p-3 text-green-600 text-xs sm:text-sm bg-green-50 border border-green-200 rounded-lg mb-4'>
              Email sent successfully!
            </div>
          </Show>

          <div class='flex flex-col gap-2'>
            <button
              type='button'
              onClick={handleResend}
              disabled={!canResend() || resending()}
              class={`text-sm font-medium transition ${
                canResend() && !resending() ?
                  'text-blue-600 hover:text-blue-700 cursor-pointer'
                : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              {resending() ?
                'Sending...'
              : canResend() ?
                "Didn't receive it? Try again"
              : 'Try again in 30s'}
            </button>
            <button
              type='button'
              onClick={handleReset}
              class='text-gray-500 hover:text-gray-700 text-sm font-medium'
            >
              Use a different email
            </button>
          </div>
        </div>
      </Show>

      {/* Form */}
      <Show when={!sent()}>
        <form onSubmit={handleSubmit} autocomplete='off'>
          <div class='space-y-4'>
            <div>
              <label
                class='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
                for='magic-link-email'
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
                id='magic-link-email'
                placeholder='you@example.com'
                disabled={loading()}
              />
            </div>

            <ErrorMessage displayError={displayError} />

            <PrimaryButton loading={loading()} loadingText='Sending Link...'>
              {props.buttonText || 'Send Sign-In Link'}
            </PrimaryButton>

            <p class='text-center text-xs text-gray-500'>
              {props.description || "We'll email you a magic link for password-free sign in."}
            </p>
          </div>
        </form>
      </Show>
    </div>
  );
}
