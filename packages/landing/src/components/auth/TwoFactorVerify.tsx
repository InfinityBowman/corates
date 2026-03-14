/**
 * Inline 2FA verification component (TOTP or backup code)
 * Rendered inside SignIn when 2FA is required after password auth
 */

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { FiLock } from 'react-icons/fi';
import { useAuthStore } from '@/stores/authStore';
import { handleError } from '@/lib/error-utils.js';
import { ErrorMessage } from './ErrorMessage';
import { PrimaryButton } from './AuthButtons';

interface TwoFactorVerifyProps {
  onCancel: () => void;
}

export function TwoFactorVerify({ onCancel }: TwoFactorVerifyProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const navigate = useNavigate();
  const verifyTwoFactor = useAuthStore(s => s.verifyTwoFactor);
  const authError = useAuthStore(s => s.authError);

  const displayError = error || authError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const codeValue = code.trim();
    if (!codeValue) {
      setError('Please enter your verification code');
      return;
    }

    if (!useBackupCode && codeValue.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setLoading(true);

    try {
      await verifyTwoFactor(codeValue);
      await new Promise(resolve => setTimeout(resolve, 200));
      navigate({ to: '/dashboard', replace: true });
    } catch (err) {
      await handleError(err, { setError, showToast: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='space-y-4'>
      <div className='mb-4 text-center'>
        <div className='bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full'>
          <FiLock className='text-primary h-8 w-8' />
        </div>
        <h2 className='text-foreground mb-1 text-xl font-bold'>Two-Factor Authentication</h2>
        <p className='text-muted-foreground text-sm'>
          {useBackupCode ?
            'Enter one of your backup codes'
          : 'Enter the code from your authenticator app'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className='space-y-4'>
        <div>
          <label
            className='text-secondary-foreground mb-2 block text-sm font-medium'
            htmlFor='2fa-code'
          >
            {useBackupCode ? 'Backup Code' : 'Verification Code'}
          </label>
          <input
            type='text'
            inputMode={useBackupCode ? 'text' : 'numeric'}
            pattern={useBackupCode ? undefined : '[0-9]*'}
            maxLength={useBackupCode ? 20 : 6}
            value={code}
            onChange={e =>
              setCode(useBackupCode ? e.target.value : e.target.value.replace(/\D/g, ''))
            }
            className='border-border focus:ring-primary w-full rounded-lg border px-4 py-3 text-center font-mono text-xl tracking-widest focus:border-transparent focus:ring-2 focus:outline-none'
            placeholder={useBackupCode ? 'XXXX-XXXX-XXXX' : '000000'}
            disabled={loading}
            id='2fa-code'
            autoFocus
            aria-describedby={displayError ? '2fa-error' : undefined}
          />
        </div>

        <ErrorMessage error={displayError} id='2fa-error' />

        <PrimaryButton loading={loading} loadingText='Verifying...'>
          Verify
        </PrimaryButton>

        <div className='space-y-2 text-center'>
          <button
            type='button'
            onClick={() => {
              setUseBackupCode(!useBackupCode);
              setCode('');
              setError('');
            }}
            className='text-primary hover:text-primary/80 text-sm font-medium'
          >
            {useBackupCode ? 'Use authenticator app instead' : 'Use a backup code'}
          </button>

          <div>
            <button
              type='button'
              onClick={onCancel}
              className='text-muted-foreground hover:text-secondary-foreground text-sm'
            >
              Cancel and try different sign-in method
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
