/**
 * MergeAccountsDialog - Self-service account merge flow
 *
 * 6-step wizard: PROMPT -> ENTER_EMAIL -> ENTER_CODE -> CONFIRM -> MERGING -> SUCCESS
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { TriangleAlertIcon, CheckIcon, LoaderIcon, UserPlusIcon, MailIcon } from 'lucide-react';
import { showToast } from '@/components/ui/toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { initiateMerge, verifyMergeCode, completeMerge, cancelMerge } from '@/api/account-merge';

const STEPS = {
  PROMPT: 'prompt',
  ENTER_EMAIL: 'enter_email',
  ENTER_CODE: 'enter_code',
  CONFIRM: 'confirm',
  MERGING: 'merging',
  SUCCESS: 'success',
} as const;

type Step = (typeof STEPS)[keyof typeof STEPS];

function formatOrcidId(id: string) {
  if (!id) return '';
  if (id.includes('-')) return id;
  return id.replace(/(\d{4})(\d{4})(\d{4})(\d{3}[\dXx])/, '$1-$2-$3-$4');
}

function normalizeOrcidInput(input: string) {
  if (!input) return '';
  let normalized = input.replace(/@orcid\.org$/i, '');
  normalized = normalized.replace(/-/g, '');
  return normalized.trim();
}

function isOrcidId(input: string) {
  const normalized = normalizeOrcidInput(input);
  return /^[\dXx]{16}$/.test(normalized);
}

/* eslint-disable no-unused-vars */
interface MergeAccountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflictProvider: string | null;
  onSuccess: () => void;
}
/* eslint-enable no-unused-vars */

export function MergeAccountsDialog({
  open,
  onOpenChange,
  conflictProvider,
  onSuccess,
}: MergeAccountsDialogProps) {
  const [step, setStep] = useState<Step>(STEPS.PROMPT);
  const [targetEmail, setTargetEmail] = useState('');
  const [targetOrcidId, setTargetOrcidId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [mergeToken, setMergeToken] = useState<string | null>(null);
  const [mergePreview, setMergePreview] = useState<{
    currentProviders: string[];
    targetProviders: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setStep(STEPS.PROMPT);
      setTargetEmail('');
      setTargetOrcidId(null);
      setVerificationCode('');
      setMergeToken(null);
      setMergePreview(null);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const isOrcidConflict = useMemo(() => conflictProvider === 'orcid', [conflictProvider]);

  const providerName = useMemo(() => {
    const names: Record<string, string> = { google: 'Google', orcid: 'ORCID' };
    return names[conflictProvider || ''] || conflictProvider || '';
  }, [conflictProvider]);

  const handleSendCode = useCallback(async () => {
    const input = targetEmail.trim();
    if (!input) {
      setError(
        isOrcidConflict ?
          'Please enter the email address or ORCID ID of the other account'
        : 'Please enter the email address of the other account',
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const isOrcid = isOrcidId(input);
      const isOrcidInput = isOrcid;
      const normalizedOrcidId = isOrcidInput ? normalizeOrcidInput(input) : null;
      const result = await initiateMerge(
        isOrcidInput ? null : input,
        isOrcidInput ? normalizedOrcidId : null,
      );
      if (isOrcidInput) {
        setTargetOrcidId(normalizedOrcidId);
      } else {
        setTargetOrcidId(null);
      }
      setMergeToken(result.mergeToken);
      setStep(STEPS.ENTER_CODE);
      const displayValue =
        isOrcid && result.targetOrcidId ? result.targetOrcidId : result.targetEmail;
      showToast.success('Code Sent', `A verification code has been sent to ${displayValue}`);
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { setError, showToast: false });
    } finally {
      setLoading(false);
    }
  }, [targetEmail, isOrcidConflict]);

  const handleVerifyCode = useCallback(
    async (codeFromInput?: string) => {
      if (loading) return;
      const code = (codeFromInput || verificationCode).trim();
      if (!code || code.length !== 6) {
        setError('Please enter the 6-digit verification code');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await verifyMergeCode(mergeToken!, code);
        if (result.preview) setMergePreview(result.preview);
        setStep(STEPS.CONFIRM);
      } catch (err) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { setError, showToast: false });
      } finally {
        setLoading(false);
      }
    },
    [loading, verificationCode, mergeToken],
  );

  const handleCompleteMerge = useCallback(async () => {
    setStep(STEPS.MERGING);
    setLoading(true);
    setError(null);
    try {
      const result = await completeMerge(mergeToken!);
      setStep(STEPS.SUCCESS);
      const linkedInfo =
        result.mergedProviders.length ? `Linked: ${result.mergedProviders.join(', ')}` : '';
      showToast.success('Accounts Merged', `Successfully merged accounts. ${linkedInfo}`);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
      setStep(STEPS.CONFIRM);
    } finally {
      setLoading(false);
    }
  }, [mergeToken, onSuccess]);

  const handleCancel = useCallback(async () => {
    if (mergeToken) {
      try {
        await cancelMerge(mergeToken);
      } catch (err: any) {
        console.warn('Failed to cancel merge:', err.message);
      }
    }
    onOpenChange(false);
  }, [mergeToken, onOpenChange]);

  const handleResendCode = useCallback(async () => {
    if (mergeToken) {
      try {
        await cancelMerge(mergeToken);
      } catch {
        // Best-effort cleanup
      }
      setMergeToken(null);
    }
    setStep(STEPS.ENTER_EMAIL);
    setVerificationCode('');
    setError(null);
  }, [mergeToken]);

  const displayTarget = targetOrcidId ? formatOrcidId(targetOrcidId) : targetEmail;

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen && step !== STEPS.MERGING) {
          if (mergeToken) {
            handleCancel();
          } else {
            onOpenChange(false);
          }
        }
      }}
    >
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>{step === STEPS.SUCCESS ? 'Accounts Merged' : 'Merge Accounts'}</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col gap-4'>
          {/* PROMPT */}
          {step === STEPS.PROMPT && (
            <>
              <Alert variant='warning'>
                <TriangleAlertIcon />
                <div>
                  <AlertTitle>This {providerName} account belongs to another user</AlertTitle>
                  <AlertDescription>
                    If you own both accounts and want to combine them, you can merge them into one.
                  </AlertDescription>
                </div>
              </Alert>
              {isOrcidConflict && (
                <Alert variant='info'>
                  <div>
                    <AlertTitle>ORCID Account Merge</AlertTitle>
                    <AlertDescription>
                      You can enter either the email address or your ORCID ID (e.g.,
                      0000-0001-2345-6789) to identify the account you want to merge.
                    </AlertDescription>
                  </div>
                </Alert>
              )}
              <p className='text-secondary-foreground text-sm'>
                Merging will combine all your projects, data, and sign-in methods into this account.
                The other account will be deleted.
              </p>
              <div className='flex justify-end gap-3 pt-2'>
                <button
                  onClick={() => onOpenChange(false)}
                  className='bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors'
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep(STEPS.ENTER_EMAIL)}
                  className='bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors'
                >
                  <UserPlusIcon className='size-4' />
                  Merge Accounts
                </button>
              </div>
            </>
          )}

          {/* ENTER_EMAIL */}
          {step === STEPS.ENTER_EMAIL && (
            <>
              <p className='text-secondary-foreground text-sm'>
                {isOrcidConflict ?
                  "Enter the email address or ORCID ID (e.g., 0000-0001-2345-6789) of the other CoRATES account. We'll send a verification code to prove you own it."
                : "Enter the email address of the other CoRATES account. We'll send a verification code to prove you own it."
                }
              </p>
              <input
                type='text'
                value={targetEmail}
                onChange={e => setTargetEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                placeholder={
                  isOrcidConflict ?
                    'Email or ORCID ID (e.g., 0000-0001-2345-6789)'
                  : 'other@example.com'
                }
                className='border-border focus:border-primary focus:ring-ring w-full rounded-lg border px-3 py-2 focus:ring-2'
                disabled={loading}
              />
              {error && <p className='text-destructive text-sm'>{error}</p>}
              <div className='flex justify-end gap-3 pt-2'>
                <button
                  onClick={() => setStep(STEPS.PROMPT)}
                  className='bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors'
                  disabled={loading}
                >
                  Back
                </button>
                <button
                  onClick={handleSendCode}
                  disabled={loading || !targetEmail.trim()}
                  className='bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50'
                >
                  {loading ?
                    <LoaderIcon className='size-4 animate-spin' />
                  : <MailIcon className='size-4' />}
                  Send Code
                </button>
              </div>
            </>
          )}

          {/* ENTER_CODE */}
          {step === STEPS.ENTER_CODE && (
            <>
              <Alert variant='info'>
                <MailIcon />
                <div>
                  <AlertTitle>Verification code sent</AlertTitle>
                  <AlertDescription>
                    Check <strong>{displayTarget}</strong> for a 6-digit code.
                  </AlertDescription>
                </div>
              </Alert>
              <div>
                <label className='text-secondary-foreground mb-1 block text-center text-sm font-medium'>
                  Verification Code
                </label>
                <div className='flex justify-center'>
                  <InputOTP
                    maxLength={6}
                    value={verificationCode}
                    onChange={setVerificationCode}
                    onComplete={handleVerifyCode}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              {error && <p className='text-destructive text-sm'>{error}</p>}
              <p className='text-muted-foreground text-xs'>
                Didn&apos;t receive the code?{' '}
                <button onClick={handleResendCode} className='text-primary hover:underline'>
                  Send again
                </button>
              </p>
              <div className='flex justify-end gap-3 pt-2'>
                <button
                  onClick={handleCancel}
                  className='bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors'
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleVerifyCode()}
                  disabled={loading || verificationCode.length !== 6}
                  className='bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50'
                >
                  {loading && <LoaderIcon className='size-4 animate-spin' />}
                  Verify Code
                </button>
              </div>
            </>
          )}

          {/* CONFIRM */}
          {step === STEPS.CONFIRM && (
            <>
              <Alert variant='success'>
                <CheckIcon />
                <div>
                  <AlertTitle>Email verified!</AlertTitle>
                  <AlertDescription>You&apos;ve confirmed access to {displayTarget}.</AlertDescription>
                </div>
              </Alert>
              {mergePreview && (
                <div className='border-border bg-muted rounded-lg border p-3 text-sm'>
                  <p className='text-secondary-foreground mb-2 font-medium'>
                    After merging, you&apos;ll have:
                  </p>
                  <ul className='text-secondary-foreground flex flex-col list-inside list-disc gap-1'>
                    <li>
                      Sign-in methods:{' '}
                      {[
                        ...new Set([
                          ...mergePreview.currentProviders,
                          ...mergePreview.targetProviders,
                        ]),
                      ].join(', ') || 'email'}
                    </li>
                    <li>All projects and data from both accounts</li>
                  </ul>
                </div>
              )}
              <Alert variant='warning'>
                <div>
                  <AlertTitle>Warning: This action cannot be undone.</AlertTitle>
                  <AlertDescription>
                    The account ({displayTarget}) will be deleted and all its data merged into your
                    current account.
                  </AlertDescription>
                </div>
              </Alert>
              {error && <p className='text-destructive text-sm'>{error}</p>}
              <div className='flex justify-end gap-3 pt-2'>
                <button
                  onClick={handleCancel}
                  className='bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors'
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCompleteMerge}
                  disabled={loading}
                  className='focus:ring-ring inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:ring-2 focus:outline-none disabled:opacity-50'
                >
                  {loading && <LoaderIcon className='size-4 animate-spin' />}
                  Merge Accounts
                </button>
              </div>
            </>
          )}

          {/* MERGING */}
          {step === STEPS.MERGING && (
            <div className='flex flex-col items-center py-6'>
              <LoaderIcon className='text-primary size-8 animate-spin' />
              <p className='text-secondary-foreground mt-3'>Merging accounts...</p>
              <p className='text-muted-foreground mt-1 text-sm'>This may take a moment.</p>
            </div>
          )}

          {/* SUCCESS */}
          {step === STEPS.SUCCESS && (
            <>
              <div className='flex flex-col items-center py-6'>
                <div className='flex size-12 items-center justify-center rounded-full bg-green-100'>
                  <CheckIcon className='size-6 text-green-600' />
                </div>
                <p className='text-foreground mt-3 font-medium'>Accounts Merged Successfully!</p>
                <p className='text-secondary-foreground mt-1 text-sm'>
                  All data has been combined into your account.
                </p>
              </div>
              <div className='flex justify-center pt-2'>
                <button
                  onClick={() => onOpenChange(false)}
                  className='bg-primary hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors'
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
