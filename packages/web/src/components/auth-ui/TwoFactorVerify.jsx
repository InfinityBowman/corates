import { createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import ErrorMessage from './ErrorMessage.jsx';
import { PrimaryButton } from './AuthButtons.jsx';

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
      <div class='text-center mb-4'>
        <div class='w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4'>
          <svg class='w-8 h-8 text-blue-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path
              stroke-linecap='round'
              stroke-linejoin='round'
              stroke-width='2'
              d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
            />
          </svg>
        </div>
        <h2 class='text-xl font-bold text-gray-900 mb-1'>Two-Factor Authentication</h2>
        <p class='text-gray-500 text-sm'>
          {useBackupCode() ?
            'Enter one of your backup codes'
          : 'Enter the code from your authenticator app'}
        </p>
      </div>

      <form onSubmit={handleSubmit} class='space-y-4'>
        <div>
          <label class='block text-sm font-medium text-gray-700 mb-2' for='2fa-code'>
            {useBackupCode() ? 'Backup Code' : 'Verification Code'}
          </label>
          <input
            type='text'
            inputMode={useBackupCode() ? 'text' : 'numeric'}
            pattern={useBackupCode() ? undefined : '[0-9]*'}
            maxLength={useBackupCode() ? 20 : 6}
            value={code()}
            onInput={e =>
              setCode(useBackupCode() ? e.target.value : e.target.value.replace(/\D/g, ''))
            }
            class='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-center font-mono text-xl tracking-widest'
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

        <div class='text-center space-y-2'>
          <button
            type='button'
            onClick={() => {
              setUseBackupCode(!useBackupCode());
              setCode('');
              setError('');
            }}
            class='text-sm text-blue-600 hover:text-blue-700 font-medium'
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
