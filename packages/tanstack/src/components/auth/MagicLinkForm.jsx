import { createSignal, Show } from 'solid-js';
import { useBetterAuth } from '@api/better-auth-store.js';
import ErrorMessage from './ErrorMessage.jsx';
import { PrimaryButton } from './AuthButtons.jsx';
import { FiMail } from 'solid-icons/fi';
import { handleError } from '@/lib/error-utils.js';

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
      await handleError(err, {
        setError,
        showToast: false,
      });
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
      await handleError(err, {
        setError,
        showToast: false,
      });
      setCanResend(true);
    } finally {
      setResending(false);
    }
  }

  return (
    <div class='space-y-4'>
      {/* Success State */}
      <Show when={sent()}>
        <div class='py-4 text-center'>
          <div class='mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100'>
            <FiMail class='h-7 w-7 text-green-600' />
          </div>
          <h3 class='mb-1 text-base font-semibold text-gray-900'>Check your email</h3>
          <p class='mb-3 text-sm text-gray-600'>
            We sent a sign-in link to <strong class='text-gray-900'>{email()}</strong>
          </p>
          <p class='mb-4 text-xs text-gray-500'>
            Click the link in the email to sign in. The link expires in 10 minutes.
          </p>

          <ErrorMessage displayError={error} />

          <Show when={resent()}>
            <div class='mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-600 sm:text-sm'>
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
                  'cursor-pointer text-blue-600 hover:text-blue-700'
                : 'cursor-not-allowed text-gray-400'
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
              class='text-sm font-medium text-gray-500 hover:text-gray-700'
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
                class='mb-1 block text-xs font-semibold text-gray-700 sm:mb-2 sm:text-sm'
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
                class='w-full rounded-lg border border-gray-300 py-2 pr-3 pl-3 text-xs transition focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none sm:pr-4 sm:pl-4 sm:text-sm'
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
