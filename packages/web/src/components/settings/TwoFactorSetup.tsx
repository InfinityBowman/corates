/**
 * TwoFactorSetup - Full 4-step 2FA enrollment/disable flow
 */

import { useState, useCallback, useId } from 'react';
import {
  ShieldIcon,
  XIcon,
  CopyIcon,
  SmartphoneIcon,
  LockIcon,
  InfoIcon,
  CircleHelpIcon,
} from 'lucide-react';
import { useAuthStore, selectUser, selectTwoFactorEnabled } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { QRCode, QRCodeFrame, QRCodePattern } from '@/components/ui/qr-code';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Spinner } from '@/components/ui/spinner';

export function TwoFactorSetup() {
  const user = useAuthStore(selectUser);
  const twoFactorEnabled = useAuthStore(selectTwoFactorEnabled);
  const enableTwoFactor = useAuthStore(s => s.enableTwoFactor);
  const verifyTwoFactorSetup = useAuthStore(s => s.verifyTwoFactorSetup);
  const disableTwoFactor = useAuthStore(s => s.disableTwoFactor);

  const fieldId = useId();
  const isEnabled = !!twoFactorEnabled;
  const [loading, setLoading] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [disableMode, setDisableMode] = useState(false);

  const [totpUri, setTotpUri] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [setupStep, setSetupStep] = useState(0);

  const [copied, setCopied] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);

  const handleStartSetup = useCallback(() => {
    setNeedsPassword(false);
    setSetupMode(true);
    setSetupStep(0);
  }, []);

  const handlePasswordSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password) {
        showToast.error('Please enter your password');
        return;
      }
      setLoading(true);
      try {
        const data = await enableTwoFactor(password);
        const result = data as { totpURI?: string; secret?: string; backupCodes?: string[] };
        setTotpUri(result.totpURI || '');
        const secretMatch = result.totpURI?.match(/[?&]secret=([^&]+)/i);
        setSecret(secretMatch ? secretMatch[1] : result.secret || '');
        setBackupCodes(result.backupCodes || []);
        setSetupStep(1);
        setPassword('');
      } catch (err: unknown) {
        const { handleError } = await import('@/lib/error-utils');
        const parsedError = await handleError(err, {
          showToast: true,
          toastTitle: '2FA Setup Failed',
        });
        const message = (parsedError?.message || '').toLowerCase();
        if (message.includes('password') || message.includes('invalid')) {
          setNeedsPassword(true);
          setSetupMode(false);
          setPassword('');
        }
      } finally {
        setLoading(false);
      }
    },
    [password, enableTwoFactor],
  );

  const handleVerifySetup = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!verificationCode || verificationCode.length !== 6) {
        showToast.error('Please enter a 6-digit code');
        return;
      }
      setLoading(true);
      try {
        await verifyTwoFactorSetup(verificationCode);
        setSetupStep(3);
      } catch (err) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { showToast: true, toastTitle: 'Verification Failed' });
      } finally {
        setLoading(false);
      }
    },
    [verificationCode, verifyTwoFactorSetup],
  );

  const handleCompleteSetup = useCallback(() => {
    setSetupMode(false);
    setSetupStep(0);
    setVerificationCode('');
    setPassword('');
    showToast.success('Two-factor authentication has been enabled');
  }, []);

  const handleStartDisable = useCallback(() => {
    setPassword('');
    setNeedsPassword(false);
    setDisableMode(true);
  }, []);

  const handleDisable = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password) {
        showToast.error('Please enter your password');
        return;
      }
      setLoading(true);
      try {
        await disableTwoFactor(password);
        setDisableMode(false);
        setPassword('');
        showToast.success('Two-factor authentication has been disabled');
      } catch (err: unknown) {
        const { handleError } = await import('@/lib/error-utils');
        const parsedError = await handleError(err, {
          showToast: true,
          toastTitle: 'Disable Failed',
        });
        const message = (parsedError?.message || '').toLowerCase();
        if (message.includes('password') || message.includes('invalid')) {
          setNeedsPassword(true);
          setDisableMode(false);
          setPassword('');
        }
      } finally {
        setLoading(false);
      }
    },
    [password, disableTwoFactor],
  );

  const copySecret = useCallback(() => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [secret]);

  const copyBackupCodes = useCallback(() => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [backupCodes]);

  const handleCancel = useCallback(() => {
    setSetupMode(false);
    setDisableMode(false);
    setSetupStep(0);
    setVerificationCode('');
    setPassword('');
    setNeedsPassword(false);
  }, []);

  return (
    <div className='flex flex-col gap-4'>
      {/* Loading state */}
      {loading && !setupMode && !disableMode && (
        <div className='flex items-center justify-center py-4'>
          <Spinner size='md' />
        </div>
      )}

      {/* Main state */}
      {!loading && !setupMode && !disableMode && (
        <>
          {needsPassword && (
            <Alert variant='warning' className='mb-4'>
              <InfoIcon />
              <div>
                <AlertTitle>Password required</AlertTitle>
                <AlertDescription>
                  Two-factor authentication requires a password. Use the &quot;Add Password&quot;
                  option above to set one up first.
                </AlertDescription>
              </div>
            </Alert>
          )}

          <div className='flex items-center justify-between'>
            <div>
              <div className='flex items-center gap-2'>
                <ShieldIcon
                  className={`size-5 ${isEnabled ? 'text-success' : 'text-muted-foreground'}`}
                />
                <p className='text-foreground font-medium'>Two-Factor Authentication</p>
                {isEnabled && <Badge variant='success'>Enabled</Badge>}
                {!isEnabled && (
                  <Tooltip>
                    <TooltipTrigger>
                      <span className='inline-flex cursor-help'>
                        <CircleHelpIcon className='text-muted-foreground size-4' />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Requires a password. Add one above if you don&apos;t have one.
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <p className='text-muted-foreground mt-1 text-sm'>
                {isEnabled ?
                  'Your account is protected with an authenticator app.'
                : 'Add an extra layer of security to your account.'}
              </p>
            </div>
            {isEnabled ?
              <Button variant='secondary' onClick={handleStartDisable}>
                Disable 2FA
              </Button>
            : <Button onClick={handleStartSetup}>Enable 2FA</Button>}
          </div>
        </>
      )}

      {/* Setup Mode */}
      {setupMode && (
        <div className='border-border flex flex-col gap-4 rounded-lg border p-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <h3 className='text-foreground font-medium'>Set Up Two-Factor Authentication</h3>
              <Tooltip>
                <TooltipTrigger>
                  <span className='inline-flex cursor-help'>
                    <CircleHelpIcon className='text-muted-foreground size-4' />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Requires a password. Add one above if you don&apos;t have one.
                </TooltipContent>
              </Tooltip>
            </div>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={handleCancel}
              className='text-muted-foreground'
              aria-label='Cancel setup'
            >
              <XIcon className='size-5' />
            </Button>
          </div>

          {/* Step 0: Password */}
          {setupStep === 0 && (
            <form onSubmit={handlePasswordSubmit} className='flex flex-col gap-4'>
              <div className='bg-primary/5 flex items-start gap-3 rounded-lg p-3'>
                <LockIcon className='text-primary mt-0.5 size-5' />
                <div className='text-primary text-sm'>
                  <p className='font-medium'>Verify your identity</p>
                  <p className='mt-1'>Enter your password to enable two-factor authentication.</p>
                </div>
              </div>
              <input
                type='text'
                autoComplete='username'
                value={user?.email || ''}
                readOnly
                className='sr-only'
                tabIndex={-1}
                aria-hidden='true'
              />
              <div>
                <Label htmlFor={`${fieldId}-setup-password`} className='mb-1'>
                  Password
                </Label>
                <PasswordInput
                  id={`${fieldId}-setup-password`}
                  autoComplete='current-password'
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
              <div className='flex gap-3'>
                <Button type='button' variant='secondary' onClick={handleCancel} className='flex-1'>
                  Cancel
                </Button>
                <Button type='submit' disabled={loading || !password} className='flex-1'>
                  {loading ? 'Verifying...' : 'Continue'}
                </Button>
              </div>
            </form>
          )}

          {/* Step 1: QR Code */}
          {setupStep === 1 && (
            <div className='flex flex-col gap-4'>
              <div className='bg-primary/5 flex items-start gap-3 rounded-lg p-3'>
                <SmartphoneIcon className='text-primary mt-0.5 size-5' />
                <div className='text-primary text-sm'>
                  <p className='font-medium'>Step 1: Scan QR Code</p>
                  <p className='mt-1'>
                    Open your authenticator app (Google Authenticator, Authy, etc.) and scan the QR
                    code below.
                  </p>
                </div>
              </div>
              <div className='flex justify-center'>
                <div className='border-border bg-card rounded-lg border p-4'>
                  <QRCode value={totpUri} pixelSize={192} aria-label='2FA QR Code'>
                    <QRCodeFrame>
                      <QRCodePattern />
                    </QRCodeFrame>
                  </QRCode>
                </div>
              </div>
              <div className='text-center'>
                <p className='text-muted-foreground mb-2 text-sm'>Or enter this code manually:</p>
                <div className='flex items-center justify-center gap-2'>
                  <code className='bg-muted text-foreground rounded px-3 py-1.5 font-mono text-sm'>
                    {secret}
                  </code>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    onClick={copySecret}
                    className='text-muted-foreground'
                    title='Copy to clipboard'
                    aria-label='Copy to clipboard'
                  >
                    <CopyIcon className='size-4' />
                  </Button>
                </div>
                {copied && <p className='text-success mt-1 text-xs'>Copied!</p>}
              </div>
              <Button onClick={() => setSetupStep(2)} className='w-full'>
                Continue
              </Button>
            </div>
          )}

          {/* Step 2: Verify */}
          {setupStep === 2 && (
            <form onSubmit={handleVerifySetup} className='flex flex-col gap-4'>
              <div className='bg-primary/5 flex items-start gap-3 rounded-lg p-3'>
                <ShieldIcon className='text-primary mt-0.5 size-5' />
                <div className='text-primary text-sm'>
                  <p className='font-medium'>Step 2: Verify Setup</p>
                  <p className='mt-1'>
                    Enter the 6-digit code from your authenticator app to verify.
                  </p>
                </div>
              </div>
              <div>
                <Label htmlFor={`${fieldId}-verification-code`} className='mb-1'>
                  Verification Code
                </Label>
                <Input
                  id={`${fieldId}-verification-code`}
                  type='text'
                  inputMode='numeric'
                  pattern='[0-9]*'
                  maxLength={6}
                  value={verificationCode}
                  onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  className='h-auto py-2 text-center font-mono text-lg tracking-widest md:text-lg'
                  placeholder='000000'
                  disabled={loading}
                />
              </div>
              <div className='flex gap-3'>
                <Button
                  type='button'
                  variant='secondary'
                  onClick={() => setSetupStep(1)}
                  className='flex-1'
                >
                  Back
                </Button>
                <Button
                  type='submit'
                  disabled={loading || verificationCode.length !== 6}
                  className='flex-1'
                >
                  {loading ? 'Verifying...' : 'Verify'}
                </Button>
              </div>
            </form>
          )}

          {/* Step 3: Backup Codes */}
          {setupStep === 3 && (
            <div className='flex flex-col gap-4'>
              <Alert variant='warning'>
                <ShieldIcon />
                <div>
                  <AlertTitle>Save Your Backup Codes</AlertTitle>
                  <AlertDescription>
                    Store these codes in a safe place. You can use them to access your account if
                    you lose your authenticator device.
                  </AlertDescription>
                </div>
              </Alert>
              <div className='bg-muted rounded-lg p-4'>
                <div className='grid grid-cols-2 gap-2'>
                  {backupCodes.map((code, i) => (
                    <code
                      key={`backup-${i}`}
                      className='border-border bg-card rounded border px-2 py-1 text-center font-mono text-sm'
                    >
                      {code}
                    </code>
                  ))}
                </div>
                <Button variant='ghost' onClick={copyBackupCodes} className='mt-3 w-full'>
                  <CopyIcon className='size-4' />
                  <span>{copied ? 'Copied!' : 'Copy all codes'}</span>
                </Button>
              </div>
              <Button variant='success' onClick={handleCompleteSetup} className='w-full'>
                I&apos;ve Saved My Backup Codes
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Disable Mode */}
      {disableMode && (
        <div className='border-border flex flex-col gap-4 rounded-lg border p-4'>
          <div className='flex items-center justify-between'>
            <h3 className='text-foreground font-medium'>Disable Two-Factor Authentication</h3>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={handleCancel}
              className='text-muted-foreground'
              aria-label='Cancel'
            >
              <XIcon className='size-5' />
            </Button>
          </div>
          <Alert variant='warning'>
            <ShieldIcon />
            <div>
              <AlertTitle>Are you sure?</AlertTitle>
              <AlertDescription>
                Disabling 2FA will make your account less secure. Enter your password to confirm.
              </AlertDescription>
            </div>
          </Alert>
          <form onSubmit={handleDisable} className='flex flex-col gap-4'>
            <div>
              <Label htmlFor={`${fieldId}-disable-password`} className='mb-1'>
                Password
              </Label>
              <PasswordInput
                id={`${fieldId}-disable-password`}
                autoComplete='current-password'
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder='Enter your password'
                disabled={loading}
              />
            </div>
            <div className='flex gap-3'>
              <Button type='button' variant='secondary' onClick={handleCancel} className='flex-1'>
                Cancel
              </Button>
              <Button
                type='submit'
                variant='destructive'
                disabled={loading || !password}
                className='flex-1'
              >
                {loading ? 'Disabling...' : 'Disable 2FA'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
