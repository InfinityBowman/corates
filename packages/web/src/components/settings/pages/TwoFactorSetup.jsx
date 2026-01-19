import { createSignal, Show, onMount, For } from 'solid-js';
import { FiShield, FiX, FiCopy, FiSmartphone, FiLock, FiInfo, FiHelpCircle } from 'solid-icons/fi';
import { useBetterAuth } from '@api/better-auth-store.js';
import { showToast } from '@/components/ui/toast';
import { QRCode, QRCodeFrame, QRCodePattern } from '@/components/ui/qr-code';
import {
  PasswordInput,
  PasswordInputLabel,
  PasswordInputControl,
  PasswordInputField,
  PasswordInputVisibilityTrigger,
} from '@/components/ui/password-input';
import {
  Tooltip,
  TooltipTrigger,
  TooltipPositioner,
  TooltipContent,
} from '@/components/ui/tooltip';

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
      const { handleError } = await import('@/lib/error-utils.js');
      const parsedError = await handleError(err, {
        showToast: true,
        toastTitle: '2FA Setup Failed',
      });
      // Check if error is about missing/invalid password - close setup and show message
      const message = parsedError.message.toLowerCase();
      if (message.includes('password') || message.includes('invalid')) {
        setNeedsPassword(true);
        setSetupMode(false); // Close setup mode to show the message in main view
        setPassword('');
      }
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
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, {
        showToast: true,
        toastTitle: 'Verification Failed',
      });
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
      const { handleError } = await import('@/lib/error-utils.js');
      const parsedError = await handleError(err, {
        showToast: true,
        toastTitle: 'Disable Failed',
      });
      const message = parsedError.message.toLowerCase();
      if (message.includes('password') || message.includes('invalid')) {
        setNeedsPassword(true);
        setDisableMode(false); // Close disable mode to show message in main view
        setPassword('');
      }
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
          <div class='border-warning/30 bg-warning-subtle mb-4 flex items-start space-x-3 rounded-lg border p-3'>
            <FiInfo class='text-warning mt-0.5 h-5 w-5 shrink-0' />
            <div class='text-warning text-sm'>
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
              <FiShield
                class={`h-5 w-5 ${isEnabled() ? 'text-success' : 'text-muted-foreground'}`}
              />
              <p class='text-foreground font-medium'>Two-Factor Authentication</p>
              <Show when={isEnabled()}>
                <span class='bg-success-subtle text-success rounded-full px-2 py-0.5 text-xs font-medium'>
                  Enabled
                </span>
              </Show>
              <Show when={!isEnabled()}>
                <Tooltip>
                  <TooltipTrigger>
                    <span class='inline-flex cursor-help'>
                      <FiHelpCircle class='text-muted-foreground h-4 w-4' />
                    </span>
                  </TooltipTrigger>
                  <TooltipPositioner>
                    <TooltipContent>
                      Requires a password. Add one above if you don't have one.
                    </TooltipContent>
                  </TooltipPositioner>
                </Tooltip>
              </Show>
            </div>
            <p class='text-muted-foreground mt-1 text-sm'>
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
                class='bg-primary hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium text-white transition'
              >
                Enable 2FA
              </button>
            }
          >
            <button
              onClick={handleStartDisable}
              class='bg-muted text-secondary-foreground hover:bg-secondary rounded-md px-4 py-2 text-sm font-medium transition'
            >
              Disable 2FA
            </button>
          </Show>
        </div>
      </Show>

      {/* Setup Mode */}
      <Show when={setupMode()}>
        <div class='border-border space-y-4 rounded-lg border p-4'>
          <div class='flex items-center justify-between'>
            <div class='flex items-center space-x-2'>
              <h3 class='text-foreground font-medium'>Set Up Two-Factor Authentication</h3>
              <Tooltip>
                <TooltipTrigger>
                  <span class='inline-flex cursor-help'>
                    <FiHelpCircle class='text-muted-foreground h-4 w-4' />
                  </span>
                </TooltipTrigger>
                <TooltipPositioner>
                  <TooltipContent>
                    Requires a password. Add one above if you don't have one.
                  </TooltipContent>
                </TooltipPositioner>
              </Tooltip>
            </div>
            <button
              onClick={handleCancel}
              class='text-muted-foreground hover:text-secondary-foreground'
            >
              <FiX class='h-5 w-5' />
            </button>
          </div>

          {/* Needs password message */}
          <Show when={needsPassword()}>
            <div class='border-warning/30 bg-warning-subtle flex items-start space-x-3 rounded-lg border p-3'>
              <FiInfo class='text-warning mt-0.5 h-5 w-5' />
              <div class='text-warning text-sm'>
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
              <div class='bg-primary-subtle flex items-start space-x-3 rounded-lg p-3'>
                <FiLock class='text-primary mt-0.5 h-5 w-5' />
                <div class='text-primary text-sm'>
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

              <PasswordInput autoComplete='current-password'>
                <PasswordInputLabel>Password</PasswordInputLabel>
                <PasswordInputControl>
                  <PasswordInputField
                    value={password()}
                    onInput={e => setPassword(e.target.value)}
                  />
                  <PasswordInputVisibilityTrigger />
                </PasswordInputControl>
              </PasswordInput>

              <div class='flex space-x-3'>
                <button
                  type='button'
                  onClick={handleCancel}
                  class='bg-muted text-secondary-foreground hover:bg-secondary flex-1 rounded-md px-4 py-2 text-sm font-medium transition'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={loading() || !password()}
                  class='bg-primary hover:bg-primary/90 flex-1 rounded-md px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50'
                >
                  {loading() ? 'Verifying...' : 'Continue'}
                </button>
              </div>
            </form>
          </Show>

          {/* Step 1: QR Code */}
          <Show when={setupStep() === 1}>
            <div class='space-y-4'>
              <div class='bg-primary-subtle flex items-start space-x-3 rounded-lg p-3'>
                <FiSmartphone class='text-primary mt-0.5 h-5 w-5' />
                <div class='text-primary text-sm'>
                  <p class='font-medium'>Step 1: Scan QR Code</p>
                  <p class='mt-1'>
                    Open your authenticator app (Google Authenticator, Authy, etc.) and scan the QR
                    code below.
                  </p>
                </div>
              </div>

              {/* QR Code - Generated client-side for security */}
              <div class='flex justify-center'>
                <div class='border-border bg-card rounded-lg border p-4'>
                  <QRCode value={totpUri()} pixelSize={192} aria-label='2FA QR Code'>
                    <QRCodeFrame>
                      <QRCodePattern />
                    </QRCodeFrame>
                  </QRCode>
                </div>
              </div>

              {/* Manual entry */}
              <div class='text-center'>
                <p class='text-muted-foreground mb-2 text-sm'>Or enter this code manually:</p>
                <div class='flex items-center justify-center space-x-2'>
                  <code class='bg-muted text-foreground rounded px-3 py-1.5 font-mono text-sm'>
                    {secret()}
                  </code>
                  <button
                    onClick={copySecret}
                    class='text-muted-foreground hover:bg-muted hover:text-secondary-foreground rounded p-1.5'
                    title='Copy to clipboard'
                  >
                    <FiCopy class='h-4 w-4' />
                  </button>
                </div>
                <Show when={copied()}>
                  <p class='text-success mt-1 text-xs'>Copied!</p>
                </Show>
              </div>

              <button
                onClick={() => setSetupStep(2)}
                class='bg-primary hover:bg-primary/90 w-full rounded-md px-4 py-2 text-sm font-medium text-white transition'
              >
                Continue
              </button>
            </div>
          </Show>

          {/* Step 2: Verify */}
          <Show when={setupStep() === 2}>
            <form onSubmit={handleVerifySetup} class='space-y-4'>
              <div class='bg-primary-subtle flex items-start space-x-3 rounded-lg p-3'>
                <FiShield class='text-primary mt-0.5 h-5 w-5' />
                <div class='text-primary text-sm'>
                  <p class='font-medium'>Step 2: Verify Setup</p>
                  <p class='mt-1'>Enter the 6-digit code from your authenticator app to verify.</p>
                </div>
              </div>

              <div>
                <label class='text-secondary-foreground mb-1 block text-sm font-medium'>
                  Verification Code
                </label>
                <input
                  type='text'
                  inputMode='numeric'
                  pattern='[0-9]*'
                  maxLength='6'
                  value={verificationCode()}
                  onInput={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  class='border-border focus:border-primary focus:ring-ring w-full rounded-md border px-3 py-2 text-center font-mono text-lg tracking-widest shadow-sm focus:outline-none'
                  placeholder='000000'
                  disabled={loading()}
                />
              </div>

              <div class='flex space-x-3'>
                <button
                  type='button'
                  onClick={() => setSetupStep(1)}
                  class='bg-muted text-secondary-foreground hover:bg-secondary flex-1 rounded-md px-4 py-2 text-sm font-medium transition'
                >
                  Back
                </button>
                <button
                  type='submit'
                  disabled={loading() || verificationCode().length !== 6}
                  class='bg-primary hover:bg-primary/90 flex-1 rounded-md px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50'
                >
                  {loading() ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </form>
          </Show>

          {/* Step 3: Backup Codes */}
          <Show when={setupStep() === 3}>
            <div class='space-y-4'>
              <div class='bg-warning-subtle flex items-start space-x-3 rounded-lg p-3'>
                <FiShield class='text-warning mt-0.5 h-5 w-5' />
                <div class='text-warning text-sm'>
                  <p class='font-medium'>Save Your Backup Codes</p>
                  <p class='mt-1'>
                    Store these codes in a safe place. You can use them to access your account if
                    you lose your authenticator device.
                  </p>
                </div>
              </div>

              <div class='bg-muted rounded-lg p-4'>
                <div class='grid grid-cols-2 gap-2'>
                  <For each={backupCodes()}>
                    {code => (
                      <code class='border-border bg-card rounded border px-2 py-1 text-center font-mono text-sm'>
                        {code}
                      </code>
                    )}
                  </For>
                </div>
                <button
                  onClick={copyBackupCodes}
                  class='text-secondary-foreground hover:bg-muted mt-3 flex w-full items-center justify-center space-x-2 rounded-md px-3 py-2 text-sm transition'
                >
                  <FiCopy class='h-4 w-4' />
                  <span>{copied() ? 'Copied!' : 'Copy all codes'}</span>
                </button>
              </div>

              <button
                onClick={handleCompleteSetup}
                class='bg-success hover:bg-success/90 w-full rounded-md px-4 py-2 text-sm font-medium text-white transition'
              >
                I've Saved My Backup Codes
              </button>
            </div>
          </Show>
        </div>
      </Show>

      {/* Disable Mode */}
      <Show when={disableMode()}>
        <div class='border-border space-y-4 rounded-lg border p-4'>
          <div class='flex items-center justify-between'>
            <h3 class='text-foreground font-medium'>Disable Two-Factor Authentication</h3>
            <button
              onClick={handleCancel}
              class='text-muted-foreground hover:text-secondary-foreground'
            >
              <FiX class='h-5 w-5' />
            </button>
          </div>

          {/* Needs password message */}
          <Show when={needsPassword()}>
            <div class='border-warning/30 bg-warning-subtle flex items-start space-x-3 rounded-lg border p-3'>
              <FiInfo class='text-warning mt-0.5 h-5 w-5' />
              <div class='text-warning text-sm'>
                <p class='font-medium'>Password required</p>
                <p class='mt-1'>
                  Disabling two-factor authentication requires a password. Use the "Add Password"
                  option above to set one up first.
                </p>
              </div>
            </div>
          </Show>

          <div class='bg-warning-subtle flex items-start space-x-3 rounded-lg p-3'>
            <FiShield class='text-warning mt-0.5 h-5 w-5' />
            <div class='text-warning text-sm'>
              <p class='font-medium'>Are you sure?</p>
              <p class='mt-1'>
                Disabling 2FA will make your account less secure. Enter your password to confirm.
              </p>
            </div>
          </div>

          <form onSubmit={handleDisable} class='space-y-4'>
            <div>
              <label class='text-secondary-foreground mb-1 block text-sm font-medium'>
                Password
              </label>
              <input
                type='password'
                value={password()}
                onInput={e => setPassword(e.target.value)}
                class='border-border focus:border-primary focus:ring-ring w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none'
                placeholder='Enter your password'
                disabled={loading()}
              />
            </div>

            <div class='flex space-x-3'>
              <button
                type='button'
                onClick={handleCancel}
                class='bg-muted text-secondary-foreground hover:bg-secondary flex-1 rounded-md px-4 py-2 text-sm font-medium transition'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={loading() || !password()}
                class='bg-destructive hover:bg-destructive/90 focus:ring-ring flex-1 rounded-md px-4 py-2 text-sm font-medium text-white transition focus:ring-2 focus:outline-none disabled:opacity-50'
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
