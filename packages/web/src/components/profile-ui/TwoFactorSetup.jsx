import { createSignal, Show, onMount, For } from 'solid-js';
import {
  FiShield,
  FiCheck,
  FiX,
  FiCopy,
  FiSmartphone,
  FiLock,
  FiInfo,
  FiHelpCircle,
} from 'solid-icons/fi';
import { useBetterAuth } from '@api/better-auth-store.js';
import Tooltip from '@components/zag/Tooltip.jsx';
import PasswordInput from '@components/zag/PasswordInput.jsx';
import { showToast } from '@components/zag/Toast.jsx';
import QRCode from '@components/zag/QRCode.jsx';

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
          <div class='w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin' />
        </div>
      </Show>

      {/* Main state - not in setup or disable mode */}
      <Show when={!loading() && !setupMode() && !disableMode()}>
        {/* Needs password message - shown when user tried to enable but doesn't have password */}
        <Show when={needsPassword()}>
          <div class='flex items-start space-x-3 p-3 mb-4 bg-amber-50 rounded-lg border border-amber-200'>
            <FiInfo class='w-5 h-5 text-amber-600 mt-0.5 shrink-0' />
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
              <FiShield class={`w-5 h-5 ${isEnabled() ? 'text-green-600' : 'text-gray-400'}`} />
              <p class='font-medium text-gray-900'>Two-Factor Authentication</p>
              <Show when={isEnabled()}>
                <span class='px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full'>
                  Enabled
                </span>
              </Show>
              <Show when={!isEnabled()}>
                <Tooltip content="Requires a password. Add one above if you don't have one.">
                  <FiHelpCircle class='w-4 h-4 text-gray-400 cursor-help' />
                </Tooltip>
              </Show>
            </div>
            <p class='text-sm text-gray-500 mt-1'>
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
                class='px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition'
              >
                Enable 2FA
              </button>
            }
          >
            <button
              onClick={handleStartDisable}
              class='px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 transition'
            >
              Disable 2FA
            </button>
          </Show>
        </div>
      </Show>

      {/* Setup Mode */}
      <Show when={setupMode()}>
        <div class='border border-gray-200 rounded-lg p-4 space-y-4'>
          <div class='flex items-center justify-between'>
            <div class='flex items-center space-x-2'>
              <h3 class='font-medium text-gray-900'>Set Up Two-Factor Authentication</h3>
              <Tooltip content="Requires a password. Add one above if you don't have one.">
                <FiHelpCircle class='w-4 h-4 text-gray-400 cursor-help' />
              </Tooltip>
            </div>
            <button onClick={handleCancel} class='text-gray-400 hover:text-gray-600'>
              <FiX class='w-5 h-5' />
            </button>
          </div>

          {/* Needs password message */}
          <Show when={needsPassword()}>
            <div class='flex items-start space-x-3 p-3 bg-amber-50 rounded-lg border border-amber-200'>
              <FiInfo class='w-5 h-5 text-amber-600 mt-0.5' />
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
              <div class='flex items-start space-x-3 p-3 bg-blue-50 rounded-lg'>
                <FiLock class='w-5 h-5 text-blue-600 mt-0.5' />
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
                  class='flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 transition'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={loading() || !password()}
                  class='flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition disabled:opacity-50'
                >
                  {loading() ? 'Verifying...' : 'Continue'}
                </button>
              </div>
            </form>
          </Show>

          {/* Step 1: QR Code */}
          <Show when={setupStep() === 1}>
            <div class='space-y-4'>
              <div class='flex items-start space-x-3 p-3 bg-blue-50 rounded-lg'>
                <FiSmartphone class='w-5 h-5 text-blue-600 mt-0.5' />
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
                <div class='p-4 bg-white border border-gray-200 rounded-lg'>
                  <QRCode data={totpUri()} size={192} alt='2FA QR Code' />
                </div>
              </div>

              {/* Manual entry */}
              <div class='text-center'>
                <p class='text-sm text-gray-500 mb-2'>Or enter this code manually:</p>
                <div class='flex items-center justify-center space-x-2'>
                  <code class='px-3 py-1.5 bg-gray-100 rounded text-sm font-mono text-gray-900'>
                    {secret()}
                  </code>
                  <button
                    onClick={copySecret}
                    class='p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded'
                    title='Copy to clipboard'
                  >
                    <FiCopy class='w-4 h-4' />
                  </button>
                </div>
                <Show when={copied()}>
                  <p class='text-xs text-green-600 mt-1'>Copied!</p>
                </Show>
              </div>

              <button
                onClick={() => setSetupStep(2)}
                class='w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition'
              >
                Continue
              </button>
            </div>
          </Show>

          {/* Step 2: Verify */}
          <Show when={setupStep() === 2}>
            <form onSubmit={handleVerifySetup} class='space-y-4'>
              <div class='flex items-start space-x-3 p-3 bg-blue-50 rounded-lg'>
                <FiShield class='w-5 h-5 text-blue-600 mt-0.5' />
                <div class='text-sm text-blue-800'>
                  <p class='font-medium'>Step 2: Verify Setup</p>
                  <p class='mt-1'>Enter the 6-digit code from your authenticator app to verify.</p>
                </div>
              </div>

              <div>
                <label class='block text-sm font-medium text-gray-700 mb-1'>
                  Verification Code
                </label>
                <input
                  type='text'
                  inputMode='numeric'
                  pattern='[0-9]*'
                  maxLength='6'
                  value={verificationCode()}
                  onInput={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  class='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center font-mono text-lg tracking-widest'
                  placeholder='000000'
                  disabled={loading()}
                />
              </div>

              <div class='flex space-x-3'>
                <button
                  type='button'
                  onClick={() => setSetupStep(1)}
                  class='flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 transition'
                >
                  Back
                </button>
                <button
                  type='submit'
                  disabled={loading() || verificationCode().length !== 6}
                  class='flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition disabled:opacity-50'
                >
                  {loading() ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </form>
          </Show>

          {/* Step 3: Backup Codes */}
          <Show when={setupStep() === 3}>
            <div class='space-y-4'>
              <div class='flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg'>
                <FiShield class='w-5 h-5 text-yellow-600 mt-0.5' />
                <div class='text-sm text-yellow-800'>
                  <p class='font-medium'>Save Your Backup Codes</p>
                  <p class='mt-1'>
                    Store these codes in a safe place. You can use them to access your account if
                    you lose your authenticator device.
                  </p>
                </div>
              </div>

              <div class='bg-gray-50 rounded-lg p-4'>
                <div class='grid grid-cols-2 gap-2'>
                  <For each={backupCodes()}>
                    {code => (
                      <code class='px-2 py-1 bg-white border border-gray-200 rounded text-sm font-mono text-center'>
                        {code}
                      </code>
                    )}
                  </For>
                </div>
                <button
                  onClick={copyBackupCodes}
                  class='mt-3 w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition'
                >
                  <FiCopy class='w-4 h-4' />
                  <span>{copied() ? 'Copied!' : 'Copy all codes'}</span>
                </button>
              </div>

              <button
                onClick={handleCompleteSetup}
                class='w-full px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition'
              >
                I've Saved My Backup Codes
              </button>
            </div>
          </Show>
        </div>
      </Show>

      {/* Disable Mode */}
      <Show when={disableMode()}>
        <div class='border border-gray-200 rounded-lg p-4 space-y-4'>
          <div class='flex items-center justify-between'>
            <h3 class='font-medium text-gray-900'>Disable Two-Factor Authentication</h3>
            <button onClick={handleCancel} class='text-gray-400 hover:text-gray-600'>
              <FiX class='w-5 h-5' />
            </button>
          </div>

          {/* Needs password message */}
          <Show when={needsPassword()}>
            <div class='flex items-start space-x-3 p-3 bg-amber-50 rounded-lg border border-amber-200'>
              <FiInfo class='w-5 h-5 text-amber-600 mt-0.5' />
              <div class='text-sm text-amber-800'>
                <p class='font-medium'>Password required</p>
                <p class='mt-1'>
                  Disabling two-factor authentication requires a password. Use the "Add Password"
                  option above to set one up first.
                </p>
              </div>
            </div>
          </Show>

          <div class='flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg'>
            <FiShield class='w-5 h-5 text-yellow-600 mt-0.5' />
            <div class='text-sm text-yellow-800'>
              <p class='font-medium'>Are you sure?</p>
              <p class='mt-1'>
                Disabling 2FA will make your account less secure. Enter your password to confirm.
              </p>
            </div>
          </div>

          <form onSubmit={handleDisable} class='space-y-4'>
            <div>
              <label class='block text-sm font-medium text-gray-700 mb-1'>Password</label>
              <input
                type='password'
                value={password()}
                onInput={e => setPassword(e.target.value)}
                class='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                placeholder='Enter your password'
                disabled={loading()}
              />
            </div>

            <div class='flex space-x-3'>
              <button
                type='button'
                onClick={handleCancel}
                class='flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 transition'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={loading() || !password()}
                class='flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition disabled:opacity-50'
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
