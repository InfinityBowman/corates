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

import { createSignal, createEffect, Show } from 'solid-js';
import { FiAlertTriangle, FiCheck, FiLoader, FiUserPlus, FiMail } from 'solid-icons/fi';
import { Dialog } from '@components/zag/Dialog.jsx';
import PinInput from '@components/zag/PinInput.jsx';
import { showToast } from '@components/zag/Toast.jsx';
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
      setVerificationCode('');
      setMergeToken(null);
      setMergePreview(null);
      setError(null);
      setLoading(false);
    }
  });

  async function handleSendCode() {
    const email = targetEmail().trim();
    if (!email) {
      setError('Please enter the email address of the other account');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await initiateMerge(email);
      setMergeToken(result.mergeToken);
      setMergePreview(result.preview);
      setStep(STEPS.ENTER_CODE);
      showToast.success('Code Sent', `A verification code has been sent to ${email}`);
    } catch (err) {
      setError(err.message);
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
      await verifyMergeCode(mergeToken(), code);
      setStep(STEPS.CONFIRM);
    } catch (err) {
      setError(err.message);
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
      showToast.success(
        'Accounts Merged',
        `Successfully merged accounts. ${result.mergedProviders.length ? `Linked: ${result.mergedProviders.join(', ')}` : ''}`,
      );
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
      } catch {
        // Ignore cancel errors
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
          <div class='flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg'>
            <FiAlertTriangle class='w-5 h-5 text-amber-600 mt-0.5 shrink-0' />
            <div class='text-sm text-amber-800'>
              <p class='font-medium'>This {providerName()} account belongs to another user</p>
              <p class='mt-1'>
                If you own both accounts and want to combine them, you can merge them into one.
              </p>
            </div>
          </div>

          <p class='text-gray-600 text-sm'>
            Merging will combine all your projects, data, and sign-in methods into this account. The
            other account will be deleted.
          </p>

          <div class='flex justify-end gap-3 pt-2'>
            <button
              onClick={() => props.onOpenChange?.(false)}
              class='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors'
            >
              Cancel
            </button>
            <button
              onClick={() => setStep(STEPS.ENTER_EMAIL)}
              class='px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2'
            >
              <FiUserPlus class='w-4 h-4' />
              Merge Accounts
            </button>
          </div>
        </Show>

        {/* Step: Enter Email */}
        <Show when={step() === STEPS.ENTER_EMAIL}>
          <p class='text-gray-600 text-sm'>
            Enter the email address of the other CoRATES account. We'll send a verification code to
            prove you own it.
          </p>

          <input
            type='email'
            value={targetEmail()}
            onInput={e => setTargetEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendCode()}
            placeholder='other@example.com'
            class='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            disabled={loading()}
          />

          <Show when={error()}>
            <p class='text-sm text-red-600'>{error()}</p>
          </Show>

          <div class='flex justify-end gap-3 pt-2'>
            <button
              onClick={() => setStep(STEPS.PROMPT)}
              class='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors'
              disabled={loading()}
            >
              Back
            </button>
            <button
              onClick={handleSendCode}
              disabled={loading() || !targetEmail().trim()}
              class='px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2'
            >
              {loading() ?
                <FiLoader class='w-4 h-4 animate-spin' />
              : <FiMail class='w-4 h-4' />}
              Send Code
            </button>
          </div>
        </Show>

        {/* Step: Enter Code */}
        <Show when={step() === STEPS.ENTER_CODE}>
          <div class='flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg'>
            <FiMail class='w-5 h-5 text-blue-600 mt-0.5 shrink-0' />
            <div class='text-sm text-blue-800'>
              <p class='font-medium'>Verification code sent</p>
              <p class='mt-1'>
                Check <strong>{targetEmail()}</strong> for a 6-digit code.
              </p>
            </div>
          </div>

          <div>
            <label class='block text-sm font-medium text-gray-700 mb-1 text-center'>
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
              class='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors'
              disabled={loading()}
            >
              Cancel
            </button>
            <button
              onClick={handleVerifyCode}
              disabled={loading() || verificationCode().length !== 6}
              class='px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2'
            >
              {loading() ?
                <FiLoader class='w-4 h-4 animate-spin' />
              : null}
              Verify Code
            </button>
          </div>
        </Show>

        {/* Step: Confirm */}
        <Show when={step() === STEPS.CONFIRM}>
          <div class='flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg'>
            <FiCheck class='w-5 h-5 text-green-600 mt-0.5 shrink-0' />
            <div class='text-sm text-green-800'>
              <p class='font-medium'>Email verified!</p>
              <p class='mt-1'>You've confirmed access to {targetEmail()}.</p>
            </div>
          </div>

          <Show when={mergePreview()}>
            <div class='p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm'>
              <p class='font-medium text-gray-700 mb-2'>After merging, you'll have:</p>
              <ul class='list-disc list-inside text-gray-600 space-y-1'>
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

          <div class='p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800'>
            <p class='font-medium'>Warning: This action cannot be undone.</p>
            <p class='mt-1'>
              The account ({targetEmail()}) will be deleted and all its data merged into your
              current account.
            </p>
          </div>

          <Show when={error()}>
            <p class='text-sm text-red-600'>{error()}</p>
          </Show>

          <div class='flex justify-end gap-3 pt-2'>
            <button
              onClick={handleCancel}
              class='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors'
              disabled={loading()}
            >
              Cancel
            </button>
            <button
              onClick={handleCompleteMerge}
              disabled={loading()}
              class='px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2'
            >
              {loading() ?
                <FiLoader class='w-4 h-4 animate-spin' />
              : null}
              Merge Accounts
            </button>
          </div>
        </Show>

        {/* Step: Merging */}
        <Show when={step() === STEPS.MERGING}>
          <div class='flex flex-col items-center py-6'>
            <FiLoader class='w-8 h-8 text-blue-600 animate-spin' />
            <p class='text-gray-600 mt-3'>Merging accounts...</p>
            <p class='text-sm text-gray-500 mt-1'>This may take a moment.</p>
          </div>
        </Show>

        {/* Step: Success */}
        <Show when={step() === STEPS.SUCCESS}>
          <div class='flex flex-col items-center py-6'>
            <div class='w-12 h-12 bg-green-100 rounded-full flex items-center justify-center'>
              <FiCheck class='w-6 h-6 text-green-600' />
            </div>
            <p class='text-gray-900 font-medium mt-3'>Accounts Merged Successfully!</p>
            <p class='text-sm text-gray-600 mt-1'>All data has been combined into your account.</p>
          </div>

          <div class='flex justify-center pt-2'>
            <button
              onClick={() => props.onOpenChange?.(false)}
              class='px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors'
            >
              Done
            </button>
          </div>
        </Show>
      </div>
    </Dialog>
  );
}
