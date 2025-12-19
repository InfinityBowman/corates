import { createSignal, Show, onMount, For } from 'solid-js';
import { FiShield, FiX, FiCopy, FiSmartphone, FiLock, FiInfo, FiHelpCircle } from 'solid-icons/fi';
import { useBetterAuth } from '@/api/betterAuthStore.js';
import { Tooltip, PasswordInput, showToast, QRCode } from '@corates/ui';

export default function TwoFactorSetup() {
  const { user, enableTwoFactor, verifyTwoFactorSetup, disableTwoFactor, getTwoFactorStatus } =
    useBetterAuth();

  // State
  const [isEnabled, setIsEnabled] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [setupMode, setSetupMode] = createSignal(false);
  const [disableMode, setDisableMode] = createSignal(false);

  // Setup state
  const [totpUri, setTotpUri] = createSignal('');
  const [secret, setSecret] = createSignal('');
  const [backupCodes, setBackupCodes] = createSignal([]);
  const [verificationCode, setVerificationCode] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [setupStep, setSetupStep] = createSignal(0); // 0: password, 1: QR code, 2: verify, 3: backup codes

  // Other state
  const [copied, setCopied] = createSignal(false);
  const [needsPassword, setNeedsPassword] = createSignal(false);

  // Check 2FA status on mount
  onMount(() => {
    const status = getTwoFactorStatus();
    setIsEnabled(status.enabled);
    setLoading(false);
  });

  // Start 2FA setup - show password step
  function handleStartSetup() {
    setNeedsPassword(false);
    setSetupMode(true);
    setSetupStep(0); // Start at password step
  }

  // Submit password and get QR code
  async function handlePasswordSubmit(e) {
    e.preventDefault();

    if (!password()) {
      showToast.error('Please enter your password');
      return;
    }

    setLoading(true);

    try {
      const data = await enableTwoFactor(password());
      setTotpUri(data.totpURI);
      // Extract secret from TOTP URI (format: otpauth://totp/...?secret=XXXXX&...)
      const secretMatch = data.totpURI?.match(/[?&]secret=([^&]+)/i);
      setSecret(secretMatch ? secretMatch[1] : data.secret || '');
      setBackupCodes(data.backupCodes || []);
      setSetupStep(1); // Move to QR code step
      setPassword(''); // Clear password
    } catch (err) {
      const message = err.message || 'Failed to start 2FA setup';
      // Check if error is about missing/invalid password - close setup and show message
      if (message.toLowerCase().includes('password') || message.toLowerCase().includes('invalid')) {
        setNeedsPassword(true);
        setSetupMode(false); // Close setup mode to show the message in main view
        setPassword('');
      }
      showToast.error(message);
    } finally {
      setLoading(false);
    }
  }

  // Verify setup code
  async function handleVerifySetup(e) {
    e.preventDefault();

    if (!verificationCode() || verificationCode().length !== 6) {
      showToast.error('Please enter a 6-digit code');
      return;
    }

    setLoading(true);

    try {
      await verifyTwoFactorSetup(verificationCode());
      setSetupStep(3); // Show backup codes
    } catch (err) {
      showToast.error(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  }

  // Complete setup
  function handleCompleteSetup() {
    setIsEnabled(true);
    setSetupMode(false);
    setSetupStep(0);
    setVerificationCode('');
    setPassword('');
    showToast.success('Two-factor authentication has been enabled');
  }

  // Start disable flow
  function handleStartDisable() {
    setPassword('');
    setNeedsPassword(false);
    setDisableMode(true);
  }

  // Disable 2FA
  async function handleDisable(e) {
    e.preventDefault();

    if (!password()) {
      showToast.error('Please enter your password');
      return;
    }

    setLoading(true);

    try {
      await disableTwoFactor(password());
      setIsEnabled(false);
      setDisableMode(false);
      setPassword('');
      showToast.success('Two-factor authentication has been disabled');
    } catch (err) {
      const message = err.message || 'Failed to disable 2FA';
      if (message.toLowerCase().includes('password') || message.toLowerCase().includes('invalid')) {
        setNeedsPassword(true);
        setDisableMode(false); // Close disable mode to show message in main view
        setPassword('');
      }
      showToast.error(message);
    } finally {
      setLoading(false);
    }
  }

  // Copy secret to clipboard
  function copySecret() {
    navigator.clipboard.writeText(secret());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Copy backup codes
  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes().join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Cancel setup/disable
  function handleCancel() {
    setSetupMode(false);
    setDisableMode(false);
    setSetupStep(0);
    setVerificationCode('');
    setPassword('');
    setNeedsPassword(false);
  }

  return (
    <div class='space-y-4'>
      {/* Loading state */}
      <Show when={loading() && !setupMode() && !disableMode()}>
        <div class='flex items-center justify-center py-4'>
          <div class='h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent' />
        </div>
      </Show>

      {/* Main state - not in setup or disable mode */}
      <Show when={!loading() && !setupMode() && !disableMode()}>
        {/* Needs password message - shown when user tried to enable but doesn't have password */}
        <Show when={needsPassword()}>
          <div class='mb-4 flex items-start space-x-3 rounded-lg border border-amber-200 bg-amber-50 p-3'>
            <FiInfo class='mt-0.5 h-5 w-5 shrink-0 text-amber-600' />
            <div class='text-sm text-amber-800'>
              <p class='font-medium'>Password required</p>
              <p class='mt-1'>
                Two-factor authentication requires a password. Use the "Add Password" option above
                to set one up first.
              </p>
            </div>
          </div>
        </Show>

        <div class='flex items-center justify-between'>
          <div>
            <div class='flex items-center space-x-2'>
              <FiShield class={`h-5 w-5 ${isEnabled() ? 'text-green-600' : 'text-gray-400'}`} />
              <p class='font-medium text-gray-900'>Two-Factor Authentication</p>
              <Show when={isEnabled()}>
                <span class='rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700'>
                  Enabled
                </span>
              </Show>
              <Show when={!isEnabled()}>
                <Tooltip content="Requires a password. Add one above if you don't have one.">
                  <FiHelpCircle class='h-4 w-4 cursor-help text-gray-400' />
                </Tooltip>
              </Show>
            </div>
            <p class='mt-1 text-sm text-gray-500'>
              {isEnabled() ?
                'Your account is protected with an authenticator app.'
              : 'Add an extra layer of security to your account.'}
            </p>
          </div>
          <Show
            when={isEnabled()}
            fallback={
              <button
                onClick={handleStartSetup}
                class='rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700'
              >
                Enable 2FA
              </button>
            }
          >
            <button
              onClick={handleStartDisable}
              class='rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200'
            >
              Disable 2FA
            </button>
          </Show>
        </div>
      </Show>

      {/* Setup Mode */}
      <Show when={setupMode()}>
        <div class='space-y-4 rounded-lg border border-gray-200 p-4'>
          <div class='flex items-center justify-between'>
            <div class='flex items-center space-x-2'>
              <h3 class='font-medium text-gray-900'>Set Up Two-Factor Authentication</h3>
              <Tooltip content="Requires a password. Add one above if you don't have one.">
                <FiHelpCircle class='h-4 w-4 cursor-help text-gray-400' />
              </Tooltip>
            </div>
            <button onClick={handleCancel} class='text-gray-400 hover:text-gray-600'>
              <FiX class='h-5 w-5' />
            </button>
          </div>

          {/* Needs password message */}
          <Show when={needsPassword()}>
            <div class='flex items-start space-x-3 rounded-lg border border-amber-200 bg-amber-50 p-3'>
              <FiInfo class='mt-0.5 h-5 w-5 text-amber-600' />
              <div class='text-sm text-amber-800'>
                <p class='font-medium'>Password required</p>
                <p class='mt-1'>
                  Two-factor authentication requires a password. Use the "Add Password" option above
                  to set one up first.
                </p>
              </div>
            </div>
          </Show>

          {/* Step 0: Password */}
          <Show when={setupStep() === 0}>
            <form onSubmit={handlePasswordSubmit} class='space-y-4'>
              <div class='flex items-start space-x-3 rounded-lg bg-blue-50 p-3'>
                <FiLock class='mt-0.5 h-5 w-5 text-blue-600' />
                <div class='text-sm text-blue-800'>
                  <p class='font-medium'>Verify your identity</p>
                  <p class='mt-1'>Enter your password to enable two-factor authentication.</p>
                </div>
              </div>

              {/* Hidden username field for accessibility */}
              <input
                type='text'
                autocomplete='username'
                value={user()?.email || ''}
                readOnly
                class='sr-only'
                tabIndex={-1}
                aria-hidden='true'
              />

              <PasswordInput
                label='Password'
                password={password()}
                onPasswordChange={setPassword}
                autoComplete='current-password'
                inputClass='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500'
              />

              <div class='flex space-x-3'>
                <button
                  type='button'
                  onClick={handleCancel}
                  class='flex-1 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={loading() || !password()}
                  class='flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50'
                >
                  {loading() ? 'Verifying...' : 'Continue'}
                </button>
              </div>
            </form>
          </Show>

          {/* Step 1: QR Code */}
          <Show when={setupStep() === 1}>
            <div class='space-y-4'>
              <div class='flex items-start space-x-3 rounded-lg bg-blue-50 p-3'>
                <FiSmartphone class='mt-0.5 h-5 w-5 text-blue-600' />
                <div class='text-sm text-blue-800'>
                  <p class='font-medium'>Step 1: Scan QR Code</p>
                  <p class='mt-1'>
                    Open your authenticator app (Google Authenticator, Authy, etc.) and scan the QR
                    code below.
                  </p>
                </div>
              </div>

              {/* QR Code - Generated client-side for security */}
              <div class='flex justify-center'>
                <div class='rounded-lg border border-gray-200 bg-white p-4'>
                  <QRCode data={totpUri()} size={192} alt='2FA QR Code' />
                </div>
              </div>

              {/* Manual entry */}
              <div class='text-center'>
                <p class='mb-2 text-sm text-gray-500'>Or enter this code manually:</p>
                <div class='flex items-center justify-center space-x-2'>
                  <code class='rounded bg-gray-100 px-3 py-1.5 font-mono text-sm text-gray-900'>
                    {secret()}
                  </code>
                  <button
                    onClick={copySecret}
                    class='rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    title='Copy to clipboard'
                  >
                    <FiCopy class='h-4 w-4' />
                  </button>
                </div>
                <Show when={copied()}>
                  <p class='mt-1 text-xs text-green-600'>Copied!</p>
                </Show>
              </div>

              <button
                onClick={() => setSetupStep(2)}
                class='w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700'
              >
                Continue
              </button>
            </div>
          </Show>

          {/* Step 2: Verify */}
          <Show when={setupStep() === 2}>
            <form onSubmit={handleVerifySetup} class='space-y-4'>
              <div class='flex items-start space-x-3 rounded-lg bg-blue-50 p-3'>
                <FiShield class='mt-0.5 h-5 w-5 text-blue-600' />
                <div class='text-sm text-blue-800'>
                  <p class='font-medium'>Step 2: Verify Setup</p>
                  <p class='mt-1'>Enter the 6-digit code from your authenticator app to verify.</p>
                </div>
              </div>

              <div>
                <label class='mb-1 block text-sm font-medium text-gray-700'>
                  Verification Code
                </label>
                <input
                  type='text'
                  inputMode='numeric'
                  pattern='[0-9]*'
                  maxLength='6'
                  value={verificationCode()}
                  onInput={e => setVerificationCode(e.target.value.replaceAll(/\D/g, ''))}
                  class='w-full rounded-md border border-gray-300 px-3 py-2 text-center font-mono text-lg tracking-widest shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none'
                  placeholder='000000'
                  disabled={loading()}
                />
              </div>

              <div class='flex space-x-3'>
                <button
                  type='button'
                  onClick={() => setSetupStep(1)}
                  class='flex-1 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200'
                >
                  Back
                </button>
                <button
                  type='submit'
                  disabled={loading() || verificationCode().length !== 6}
                  class='flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50'
                >
                  {loading() ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </form>
          </Show>

          {/* Step 3: Backup Codes */}
          <Show when={setupStep() === 3}>
            <div class='space-y-4'>
              <div class='flex items-start space-x-3 rounded-lg bg-yellow-50 p-3'>
                <FiShield class='mt-0.5 h-5 w-5 text-yellow-600' />
                <div class='text-sm text-yellow-800'>
                  <p class='font-medium'>Save Your Backup Codes</p>
                  <p class='mt-1'>
                    Store these codes in a safe place. You can use them to access your account if
                    you lose your authenticator device.
                  </p>
                </div>
              </div>

              <div class='rounded-lg bg-gray-50 p-4'>
                <div class='grid grid-cols-2 gap-2'>
                  <For each={backupCodes()}>
                    {code => (
                      <code class='rounded border border-gray-200 bg-white px-2 py-1 text-center font-mono text-sm'>
                        {code}
                      </code>
                    )}
                  </For>
                </div>
                <button
                  onClick={copyBackupCodes}
                  class='mt-3 flex w-full items-center justify-center space-x-2 rounded-md px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100'
                >
                  <FiCopy class='h-4 w-4' />
                  <span>{copied() ? 'Copied!' : 'Copy all codes'}</span>
                </button>
              </div>

              <button
                onClick={handleCompleteSetup}
                class='w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700'
              >
                I've Saved My Backup Codes
              </button>
            </div>
          </Show>
        </div>
      </Show>

      {/* Disable Mode */}
      <Show when={disableMode()}>
        <div class='space-y-4 rounded-lg border border-gray-200 p-4'>
          <div class='flex items-center justify-between'>
            <h3 class='font-medium text-gray-900'>Disable Two-Factor Authentication</h3>
            <button onClick={handleCancel} class='text-gray-400 hover:text-gray-600'>
              <FiX class='h-5 w-5' />
            </button>
          </div>

          {/* Needs password message */}
          <Show when={needsPassword()}>
            <div class='flex items-start space-x-3 rounded-lg border border-amber-200 bg-amber-50 p-3'>
              <FiInfo class='mt-0.5 h-5 w-5 text-amber-600' />
              <div class='text-sm text-amber-800'>
                <p class='font-medium'>Password required</p>
                <p class='mt-1'>
                  Disabling two-factor authentication requires a password. Use the "Add Password"
                  option above to set one up first.
                </p>
              </div>
            </div>
          </Show>

          <div class='flex items-start space-x-3 rounded-lg bg-yellow-50 p-3'>
            <FiShield class='mt-0.5 h-5 w-5 text-yellow-600' />
            <div class='text-sm text-yellow-800'>
              <p class='font-medium'>Are you sure?</p>
              <p class='mt-1'>
                Disabling 2FA will make your account less secure. Enter your password to confirm.
              </p>
            </div>
          </div>

          <form onSubmit={handleDisable} class='space-y-4'>
            <div>
              <label class='mb-1 block text-sm font-medium text-gray-700'>Password</label>
              <input
                type='password'
                value={password()}
                onInput={e => setPassword(e.target.value)}
                class='w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none'
                placeholder='Enter your password'
                disabled={loading()}
              />
            </div>

            <div class='flex space-x-3'>
              <button
                type='button'
                onClick={handleCancel}
                class='flex-1 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={loading() || !password()}
                class='flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50'
              >
                {loading() ? 'Disabling...' : 'Disable 2FA'}
              </button>
            </div>
          </form>
        </div>
      </Show>
    </div>
  );
}
