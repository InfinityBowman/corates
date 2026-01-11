/**
 * MergeAccountsDialog - Self-service account merge flow
 *
 * Shown when a user tries to link an OAuth account that belongs to another user.
 * Uses email verification code to prove ownership of the other account.
 *
 * Flow:
 * 1. PROMPT - Ask if they want to merge
 * 2. ENTER_EMAIL - Enter the other account's email
 * 3. ENTER_CODE - Enter the 6-digit code sent to that email
 * 4. CONFIRM - Final confirmation before merge
 * 5. MERGING - Processing
 * 6. SUCCESS - Done
 */

import { createSignal, createEffect, Show, createMemo } from 'solid-js';
import { FiAlertTriangle, FiCheck, FiLoader, FiUserPlus, FiMail } from 'solid-icons/fi';
import { Dialog, PinInput, showToast } from '@corates/ui';
import { initiateMerge, verifyMergeCode, completeMerge, cancelMerge } from '@api/account-merge.js';

// Merge flow steps
const STEPS = {
  PROMPT: 'prompt',
  ENTER_EMAIL: 'enter_email',
  ENTER_CODE: 'enter_code',
  CONFIRM: 'confirm',
  MERGING: 'merging',
  SUCCESS: 'success',
};

export default function MergeAccountsDialog(props) {
  // props: open, onOpenChange, conflictProvider (e.g., 'google'), onSuccess

  const [step, setStep] = createSignal(STEPS.PROMPT);
  const [targetEmail, setTargetEmail] = createSignal('');
  const [targetOrcidId, setTargetOrcidId] = createSignal(null);
  const [verificationCode, setVerificationCode] = createSignal('');
  const [mergeToken, setMergeToken] = createSignal(null);
  const [mergePreview, setMergePreview] = createSignal(null);
  const [error, setError] = createSignal(null);
  const [loading, setLoading] = createSignal(false);

  // Reset state when dialog opens/closes
  createEffect(() => {
    if (props.open) {
      setStep(STEPS.PROMPT);
      setTargetEmail('');
      setTargetOrcidId(null);
      setVerificationCode('');
      setMergeToken(null);
      setMergePreview(null);
      setError(null);
      setLoading(false);
    }
  });

  // Check if this is an ORCID conflict
  const isOrcidConflict = createMemo(() => props.conflictProvider === 'orcid');

  /**
   * Normalize ORCID ID input (remove hyphens, handle @orcid.org suffix)
   */
  function normalizeOrcidInput(input) {
    if (!input) return '';
    // Remove @orcid.org suffix if present
    let normalized = input.replace(/@orcid\.org$/i, '');
    // Remove hyphens
    normalized = normalized.replace(/-/g, '');
    return normalized.trim();
  }

  /**
   * Check if input looks like an ORCID ID (16 digits) or email
   */
  function isOrcidId(input) {
    const normalized = normalizeOrcidInput(input);
    // ORCID IDs are 16 characters (digits, last can be X)
    return /^[\dXx]{16}$/.test(normalized);
  }

  async function handleSendCode() {
    const input = targetEmail().trim();
    if (!input) {
      setError(
        isOrcidConflict() ?
          'Please enter the email address or ORCID ID of the other account'
        : 'Please enter the email address of the other account',
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Determine if input is ORCID ID or email
      const isOrcid = isOrcidId(input);
      let result;

      if (isOrcid) {
        const normalizedOrcidId = normalizeOrcidInput(input);
        result = await initiateMerge(null, normalizedOrcidId);
        setTargetOrcidId(normalizedOrcidId);
      } else {
        result = await initiateMerge(input, null);
        setTargetOrcidId(null);
      }

      setMergeToken(result.mergeToken);
      // Preview with targetProviders is deferred until after code verification
      setStep(STEPS.ENTER_CODE);

      const displayValue =
        isOrcid && result.targetOrcidId ? result.targetOrcidId : result.targetEmail;
      showToast.success('Code Sent', `A verification code has been sent to ${displayValue}`);
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, {
        setError,
        showToast: false,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(codeFromPinInput) {
    // Prevent double submission
    if (loading()) return;

    // Use code passed from onComplete, or fall back to signal
    const code = (codeFromPinInput || verificationCode()).trim();
    if (!code || code.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await verifyMergeCode(mergeToken(), code);
      // Preview with full provider info is returned after successful verification
      if (result.preview) {
        setMergePreview(result.preview);
      }
      setStep(STEPS.CONFIRM);
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, {
        setError,
        showToast: false,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteMerge() {
    setStep(STEPS.MERGING);
    setLoading(true);
    setError(null);

    try {
      const result = await completeMerge(mergeToken());
      setStep(STEPS.SUCCESS);
      const linkedInfo =
        result.mergedProviders.length ? `Linked: ${result.mergedProviders.join(', ')}` : '';
      showToast.success('Accounts Merged', `Successfully merged accounts. ${linkedInfo}`);
      props.onSuccess?.();
    } catch (err) {
      setError(err.message);
      setStep(STEPS.CONFIRM);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (mergeToken()) {
      try {
        await cancelMerge(mergeToken());
      } catch (err) {
        console.warn('Failed to cancel merge:', err.message);
      }
    }
    props.onOpenChange?.(false);
  }

  function handleResendCode() {
    setStep(STEPS.ENTER_EMAIL);
    setVerificationCode('');
    setError(null);
  }

  const providerName = () => {
    const names = { google: 'Google', orcid: 'ORCID' };
    return names[props.conflictProvider] || props.conflictProvider;
  };

  /**
   * Format ORCID ID for display (add hyphens if not present)
   */
  function formatOrcidId(id) {
    if (!id) return '';
    // If already formatted with hyphens, return as-is
    if (id.includes('-')) return id;
    // Format as XXXX-XXXX-XXXX-XXXX (last char can be X for checksum)
    return id.replace(/(\d{4})(\d{4})(\d{4})(\d{3}[\dXx])/, '$1-$2-$3-$4');
  }

  // Preserve reactivity for open prop
  const isOpen = () => props.open;

  return (
    <Dialog
      open={isOpen()}
      onOpenChange={open => {
        if (!open && step() !== STEPS.MERGING) {
          handleCancel();
        }
      }}
      title={step() === STEPS.SUCCESS ? 'Accounts Merged' : 'Merge Accounts'}
    >
      <div class='space-y-4'>
        {/* Step: Prompt */}
        <Show when={step() === STEPS.PROMPT}>
          <div class='flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3'>
            <FiAlertTriangle class='mt-0.5 h-5 w-5 shrink-0 text-amber-600' />
            <div class='text-sm text-amber-800'>
              <p class='font-medium'>This {providerName()} account belongs to another user</p>
              <p class='mt-1'>
                If you own both accounts and want to combine them, you can merge them into one.
              </p>
            </div>
          </div>

          <Show when={isOrcidConflict()}>
            <div class='rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800'>
              <p class='font-medium'>ORCID Account Merge</p>
              <p class='mt-1'>
                You can enter either the email address or your ORCID ID (e.g., 0000-0001-2345-6789)
                to identify the account you want to merge.
              </p>
            </div>
          </Show>

          <p class='text-sm text-gray-600'>
            Merging will combine all your projects, data, and sign-in methods into this account. The
            other account will be deleted.
          </p>

          <div class='flex justify-end gap-3 pt-2'>
            <button
              onClick={() => props.onOpenChange?.(false)}
              class='rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200'
            >
              Cancel
            </button>
            <button
              onClick={() => setStep(STEPS.ENTER_EMAIL)}
              class='inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'
            >
              <FiUserPlus class='h-4 w-4' />
              Merge Accounts
            </button>
          </div>
        </Show>

        {/* Step: Enter Email */}
        <Show when={step() === STEPS.ENTER_EMAIL}>
          <p class='text-sm text-gray-600'>
            {isOrcidConflict() ?
              `Enter the email address or ORCID ID (e.g., 0000-0001-2345-6789) of the other CoRATES account. We'll send a verification code to prove you own it.`
            : `Enter the email address of the other CoRATES account. We'll send a verification code to prove you own it.`
            }
          </p>

          <input
            type='text'
            value={targetEmail()}
            onInput={e => setTargetEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendCode()}
            placeholder={
              isOrcidConflict() ?
                'Email or ORCID ID (e.g., 0000-0001-2345-6789)'
              : 'other@example.com'
            }
            class='w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
            disabled={loading()}
          />

          <Show when={error()}>
            <p class='text-sm text-red-600'>{error()}</p>
          </Show>

          <div class='flex justify-end gap-3 pt-2'>
            <button
              onClick={() => setStep(STEPS.PROMPT)}
              class='rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200'
              disabled={loading()}
            >
              Back
            </button>
            <button
              onClick={handleSendCode}
              disabled={loading() || !targetEmail().trim()}
              class='inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50'
            >
              {loading() ?
                <FiLoader class='h-4 w-4 animate-spin' />
              : <FiMail class='h-4 w-4' />}
              Send Code
            </button>
          </div>
        </Show>

        {/* Step: Enter Code */}
        <Show when={step() === STEPS.ENTER_CODE}>
          <div class='flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3'>
            <FiMail class='mt-0.5 h-5 w-5 shrink-0 text-blue-600' />
            <div class='text-sm text-blue-800'>
              <p class='font-medium'>Verification code sent</p>
              <p class='mt-1'>
                Check{' '}
                <strong>{targetOrcidId() ? formatOrcidId(targetOrcidId()) : targetEmail()}</strong>{' '}
                for a 6-digit code.
              </p>
            </div>
          </div>

          <div>
            <label class='mb-1 block text-center text-sm font-medium text-gray-700'>
              Verification Code
            </label>
            <PinInput
              onInput={value => setVerificationCode(value)}
              onComplete={handleVerifyCode}
              isError={!!error()}
            />
          </div>

          <Show when={error()}>
            <p class='text-sm text-red-600'>{error()}</p>
          </Show>

          <p class='text-xs text-gray-500'>
            Didn't receive the code?{' '}
            <button onClick={handleResendCode} class='text-blue-600 hover:underline'>
              Send again
            </button>
          </p>

          <div class='flex justify-end gap-3 pt-2'>
            <button
              onClick={handleCancel}
              class='rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200'
              disabled={loading()}
            >
              Cancel
            </button>
            <button
              onClick={handleVerifyCode}
              disabled={loading() || verificationCode().length !== 6}
              class='inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50'
            >
              {loading() ?
                <FiLoader class='h-4 w-4 animate-spin' />
              : null}
              Verify Code
            </button>
          </div>
        </Show>

        {/* Step: Confirm */}
        <Show when={step() === STEPS.CONFIRM}>
          <div class='flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3'>
            <FiCheck class='mt-0.5 h-5 w-5 shrink-0 text-green-600' />
            <div class='text-sm text-green-800'>
              <p class='font-medium'>Email verified!</p>
              <p class='mt-1'>
                You've confirmed access to{' '}
                {targetOrcidId() ? formatOrcidId(targetOrcidId()) : targetEmail()}.
              </p>
            </div>
          </div>

          <Show when={mergePreview()}>
            <div class='rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm'>
              <p class='mb-2 font-medium text-gray-700'>After merging, you'll have:</p>
              <ul class='list-inside list-disc space-y-1 text-gray-600'>
                <li>
                  Sign-in methods:{' '}
                  {[
                    ...new Set([
                      ...mergePreview().currentProviders,
                      ...mergePreview().targetProviders,
                    ]),
                  ].join(', ') || 'email'}
                </li>
                <li>All projects and data from both accounts</li>
              </ul>
            </div>
          </Show>

          <div class='rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800'>
            <p class='font-medium'>Warning: This action cannot be undone.</p>
            <p class='mt-1'>
              The account ({targetOrcidId() ? formatOrcidId(targetOrcidId()) : targetEmail()}) will
              be deleted and all its data merged into your current account.
            </p>
          </div>

          <Show when={error()}>
            <p class='text-sm text-red-600'>{error()}</p>
          </Show>

          <div class='flex justify-end gap-3 pt-2'>
            <button
              onClick={handleCancel}
              class='rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200'
              disabled={loading()}
            >
              Cancel
            </button>
            <button
              onClick={handleCompleteMerge}
              disabled={loading()}
              class='inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50'
            >
              {loading() ?
                <FiLoader class='h-4 w-4 animate-spin' />
              : null}
              Merge Accounts
            </button>
          </div>
        </Show>

        {/* Step: Merging */}
        <Show when={step() === STEPS.MERGING}>
          <div class='flex flex-col items-center py-6'>
            <FiLoader class='h-8 w-8 animate-spin text-blue-600' />
            <p class='mt-3 text-gray-600'>Merging accounts...</p>
            <p class='mt-1 text-sm text-gray-500'>This may take a moment.</p>
          </div>
        </Show>

        {/* Step: Success */}
        <Show when={step() === STEPS.SUCCESS}>
          <div class='flex flex-col items-center py-6'>
            <div class='flex h-12 w-12 items-center justify-center rounded-full bg-green-100'>
              <FiCheck class='h-6 w-6 text-green-600' />
            </div>
            <p class='mt-3 font-medium text-gray-900'>Accounts Merged Successfully!</p>
            <p class='mt-1 text-sm text-gray-600'>All data has been combined into your account.</p>
          </div>

          <div class='flex justify-center pt-2'>
            <button
              onClick={() => props.onOpenChange?.(false)}
              class='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'
            >
              Done
            </button>
          </div>
        </Show>
      </div>
    </Dialog>
  );
}
