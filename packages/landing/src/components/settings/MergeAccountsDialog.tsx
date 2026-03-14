/**
 * MergeAccountsDialog - Self-service account merge flow
 *
 * 6-step wizard: PROMPT -> ENTER_EMAIL -> ENTER_CODE -> CONFIRM -> MERGING -> SUCCESS
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TriangleAlertIcon,
  CheckIcon,
  LoaderIcon,
  UserPlusIcon,
  MailIcon,
} from 'lucide-react';
import { showToast } from '@/components/ui/toast';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { initiateMerge, verifyMergeCode, completeMerge, cancelMerge } from '@/api/account-merge.js';

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
        isOrcidConflict
          ? 'Please enter the email address or ORCID ID of the other account'
          : 'Please enter the email address of the other account',
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const isOrcid = isOrcidId(input);
      let result: any;
      if (isOrcid) {
        const normalizedOrcidId = normalizeOrcidInput(input);
        result = await initiateMerge(null as any, normalizedOrcidId);
        setTargetOrcidId(normalizedOrcidId);
      } else {
        result = await initiateMerge(input, null as any);
        setTargetOrcidId(null);
      }
      setMergeToken(result.mergeToken);
      setStep(STEPS.ENTER_CODE);
      const displayValue =
        isOrcid && result.targetOrcidId ? result.targetOrcidId : result.targetEmail;
      showToast.success('Code Sent', `A verification code has been sent to ${displayValue}`);
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js');
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
        const { handleError } = await import('@/lib/error-utils.js');
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === STEPS.SUCCESS ? 'Accounts Merged' : 'Merge Accounts'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* PROMPT */}
          {step === STEPS.PROMPT && (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <TriangleAlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">
                    This {providerName} account belongs to another user
                  </p>
                  <p className="mt-1">
                    If you own both accounts and want to combine them, you can merge them into
                    one.
                  </p>
                </div>
              </div>
              {isOrcidConflict && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  <p className="font-medium">ORCID Account Merge</p>
                  <p className="mt-1">
                    You can enter either the email address or your ORCID ID (e.g.,
                    0000-0001-2345-6789) to identify the account you want to merge.
                  </p>
                </div>
              )}
              <p className="text-secondary-foreground text-sm">
                Merging will combine all your projects, data, and sign-in methods into this
                account. The other account will be deleted.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => onOpenChange(false)}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep(STEPS.ENTER_EMAIL)}
                  className="bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                >
                  <UserPlusIcon className="h-4 w-4" />
                  Merge Accounts
                </button>
              </div>
            </>
          )}

          {/* ENTER_EMAIL */}
          {step === STEPS.ENTER_EMAIL && (
            <>
              <p className="text-secondary-foreground text-sm">
                {isOrcidConflict
                  ? "Enter the email address or ORCID ID (e.g., 0000-0001-2345-6789) of the other CoRATES account. We'll send a verification code to prove you own it."
                  : "Enter the email address of the other CoRATES account. We'll send a verification code to prove you own it."}
              </p>
              <input
                type="text"
                value={targetEmail}
                onChange={e => setTargetEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                placeholder={
                  isOrcidConflict
                    ? 'Email or ORCID ID (e.g., 0000-0001-2345-6789)'
                    : 'other@example.com'
                }
                className="border-border focus:border-primary focus:ring-ring w-full rounded-lg border px-3 py-2 focus:ring-2"
                disabled={loading}
              />
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setStep(STEPS.PROMPT)}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                  disabled={loading}
                >
                  Back
                </button>
                <button
                  onClick={handleSendCode}
                  disabled={loading || !targetEmail.trim()}
                  className="bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <LoaderIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <MailIcon className="h-4 w-4" />
                  )}
                  Send Code
                </button>
              </div>
            </>
          )}

          {/* ENTER_CODE */}
          {step === STEPS.ENTER_CODE && (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <MailIcon className="text-primary mt-0.5 h-5 w-5 shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Verification code sent</p>
                  <p className="mt-1">
                    Check <strong>{displayTarget}</strong> for a 6-digit code.
                  </p>
                </div>
              </div>
              <div>
                <label className="text-secondary-foreground mb-1 block text-center text-sm font-medium">
                  Verification Code
                </label>
                <div className="flex justify-center">
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
              {error && <p className="text-destructive text-sm">{error}</p>}
              <p className="text-muted-foreground text-xs">
                Didn&apos;t receive the code?{' '}
                <button onClick={handleResendCode} className="text-primary hover:underline">
                  Send again
                </button>
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleCancel}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleVerifyCode()}
                  disabled={loading || verificationCode.length !== 6}
                  className="bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
                >
                  {loading && <LoaderIcon className="h-4 w-4 animate-spin" />}
                  Verify Code
                </button>
              </div>
            </>
          )}

          {/* CONFIRM */}
          {step === STEPS.CONFIRM && (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
                <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                <div className="text-sm text-green-800">
                  <p className="font-medium">Email verified!</p>
                  <p className="mt-1">You&apos;ve confirmed access to {displayTarget}.</p>
                </div>
              </div>
              {mergePreview && (
                <div className="border-border bg-muted rounded-lg border p-3 text-sm">
                  <p className="text-secondary-foreground mb-2 font-medium">
                    After merging, you&apos;ll have:
                  </p>
                  <ul className="text-secondary-foreground list-inside list-disc space-y-1">
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
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-medium">Warning: This action cannot be undone.</p>
                <p className="mt-1">
                  The account ({displayTarget}) will be deleted and all its data merged into your
                  current account.
                </p>
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleCancel}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCompleteMerge}
                  disabled={loading}
                  className="focus:ring-ring inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:ring-2 focus:outline-none disabled:opacity-50"
                >
                  {loading && <LoaderIcon className="h-4 w-4 animate-spin" />}
                  Merge Accounts
                </button>
              </div>
            </>
          )}

          {/* MERGING */}
          {step === STEPS.MERGING && (
            <div className="flex flex-col items-center py-6">
              <LoaderIcon className="text-primary h-8 w-8 animate-spin" />
              <p className="text-secondary-foreground mt-3">Merging accounts...</p>
              <p className="text-muted-foreground mt-1 text-sm">This may take a moment.</p>
            </div>
          )}

          {/* SUCCESS */}
          {step === STEPS.SUCCESS && (
            <>
              <div className="flex flex-col items-center py-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckIcon className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-foreground mt-3 font-medium">Accounts Merged Successfully!</p>
                <p className="text-secondary-foreground mt-1 text-sm">
                  All data has been combined into your account.
                </p>
              </div>
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => onOpenChange(false)}
                  className="bg-primary hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
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
