/**
 * DeleteAccountSection - Danger zone with account deletion confirmation
 */

import { createSignal, Show } from 'solid-js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { showToast } from '@/components/ui/toast';
import { LANDING_URL } from '@config/api.js';

export default function DeleteAccountSection() {
  const auth = useBetterAuth();
  const user = () => auth.user();

  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [deleteConfirmText, setDeleteConfirmText] = createSignal('');
  const [deletingAccount, setDeletingAccount] = createSignal(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText() !== 'DELETE') {
      showToast.error('Confirmation Required', 'Please type DELETE to confirm.');
      return;
    }

    setDeletingAccount(true);

    try {
      await auth.deleteAccount();
      showToast.success('Account Deleted', 'Your account has been deleted.');
      window.location.href = LANDING_URL;
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, { toastTitle: 'Delete Failed' });
      setDeletingAccount(false);
    }
  };

  return (
    <Show when={user()}>
      <div class='rounded-xl border border-red-200/60 bg-red-50/30 p-5'>
        <Show
          when={showDeleteConfirm()}
          fallback={
            <div class='flex items-center justify-between'>
              <div>
                <h3 class='font-medium text-slate-900'>Delete Account</h3>
                <p class='mt-0.5 text-sm text-slate-600'>
                  Permanently delete your account and all associated data
                </p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                class='rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-all hover:bg-red-50 hover:shadow'
              >
                Delete Account
              </button>
            </div>
          }
        >
          <div class='space-y-4'>
            <div class='rounded-lg border border-red-200 bg-red-100/80 p-4'>
              <p class='mb-2 text-sm font-medium text-red-800'>
                Are you sure you want to delete your account?
              </p>
              <ul class='list-inside list-disc space-y-1 text-sm text-red-700'>
                <li>All your projects will be permanently deleted</li>
                <li>All your checklists and reviews will be lost</li>
                <li>You will be removed from all shared projects</li>
                <li>This action cannot be undone</li>
              </ul>
            </div>

            <div>
              <label class='mb-1.5 block text-sm font-medium text-slate-700'>
                Type <span class='font-mono font-semibold text-red-600'>DELETE</span> to confirm
              </label>
              <input
                type='text'
                value={deleteConfirmText()}
                onInput={e => setDeleteConfirmText(e.target.value)}
                class='block w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none'
                placeholder='DELETE'
              />
            </div>

            <div class='flex gap-2'>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount() || deleteConfirmText() !== 'DELETE'}
                class='rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-50'
              >
                {deletingAccount() ? 'Deleting...' : 'Permanently Delete Account'}
              </button>
              <button
                type='button'
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                class='rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200'
              >
                Cancel
              </button>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}
