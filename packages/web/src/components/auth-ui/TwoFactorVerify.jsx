import { createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import ErrorMessage from './ErrorMessage.jsx';
import { PrimaryButton } from './AuthButtons.jsx';
import { FiLock } from 'solid-icons/fi';

export default function TwoFactorVerify(props) {
  const [code, setCode] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [useBackupCode, setUseBackupCode] = createSignal(false);
  const navigate = useNavigate();
  const { verifyTwoFactor, authError } = useBetterAuth();

  const displayError = () => error() || authError();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const codeValue = code().trim();
    if (!codeValue) {
      setError('Please enter your verification code');
      return;
    }

    // TOTP codes are 6 digits, backup codes are longer
    if (!useBackupCode() && codeValue.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setLoading(true);

    try {
      await verifyTwoFactor(codeValue);

      // Small delay for better UX
      await new Promise(resolve => setTimeout(resolve, 200));

      // Navigate to dashboard on success
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('2FA verification error:', err);
      const msg = err.message?.toLowerCase() || '';

      if (msg.includes('invalid') || msg.includes('incorrect')) {
        setError(useBackupCode() ? 'Invalid backup code' : 'Invalid verification code');
      } else if (msg.includes('expired')) {
        setError('Code expired. Please try again.');
      } else {
        setError('Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    // Go back to sign in
    if (props.onCancel) {
      props.onCancel();
    }
  }

  return (
    <div class='space-y-4'>
      <div class='mb-4 text-center'>
        <div class='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100'>
          <FiLock class='h-8 w-8 text-blue-600' />
        </div>
        <h2 class='mb-1 text-xl font-bold text-gray-900'>Two-Factor Authentication</h2>
        <p class='text-sm text-gray-500'>
          {useBackupCode() ?
            'Enter one of your backup codes'
          : 'Enter the code from your authenticator app'}
        </p>
      </div>

      <form onSubmit={handleSubmit} class='space-y-4'>
        <div>
          <label class='mb-2 block text-sm font-medium text-gray-700' for='2fa-code'>
            {useBackupCode() ? 'Backup Code' : 'Verification Code'}
          </label>
          <input
            type='text'
            inputMode={useBackupCode() ? 'text' : 'numeric'}
            pattern={useBackupCode() ? undefined : '[0-9]*'}
            maxLength={useBackupCode() ? 20 : 6}
            value={code()}
            onInput={e =>
              setCode(useBackupCode() ? e.target.value : e.target.value.replaceAll(/\D/g, ''))
            }
            class='w-full rounded-lg border border-gray-300 px-4 py-3 text-center font-mono text-xl tracking-widest focus:ring-2 focus:ring-blue-400 focus:outline-none'
            placeholder={useBackupCode() ? 'XXXX-XXXX-XXXX' : '000000'}
            disabled={loading()}
            id='2fa-code'
            autoFocus
          />
        </div>

        <ErrorMessage displayError={displayError} />

        <PrimaryButton loading={loading()} loadingText='Verifying...'>
          Verify
        </PrimaryButton>

        <div class='space-y-2 text-center'>
          <button
            type='button'
            onClick={() => {
              setUseBackupCode(!useBackupCode());
              setCode('');
              setError('');
            }}
            class='text-sm font-medium text-blue-600 hover:text-blue-700'
          >
            {useBackupCode() ? 'Use authenticator app instead' : 'Use a backup code'}
          </button>

          <div>
            <button
              type='button'
              onClick={handleCancel}
              class='text-sm text-gray-500 hover:text-gray-700'
            >
              Cancel and try different sign-in method
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
