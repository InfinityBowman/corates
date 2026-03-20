/**
 * DeleteAccountSection - Danger zone with account deletion confirmation
 */

import { useState, useCallback } from 'react';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { showToast } from '@/components/ui/toast';

export function DeleteAccountSection() {
  const user = useAuthStore(selectUser);
  const deleteAccount = useAuthStore(s => s.deleteAccount);

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (confirmText !== 'DELETE') {
      showToast.error('Confirmation Required', 'Please type DELETE to confirm.');
      return;
    }

    setDeleting(true);
    try {
      await deleteAccount();
      showToast.success('Account Deleted', 'Your account has been deleted.');
      window.location.href = '/';
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Delete Failed' });
      setDeleting(false);
    }
  }, [confirmText, deleteAccount]);

  if (!user) return null;

  return (
    <div className='border-destructive/20 bg-destructive/10 rounded-xl border p-5'>
      {showConfirm ?
        <div className='flex flex-col gap-4'>
          <div className='border-destructive/20 bg-destructive/10 rounded-lg border p-4'>
            <p className='text-destructive mb-2 text-sm font-medium'>
              Are you sure you want to delete your account?
            </p>
            <ul className='text-destructive flex list-inside list-disc flex-col gap-1 text-sm'>
              <li>All your projects will be permanently deleted</li>
              <li>All your checklists and reviews will be lost</li>
              <li>You will be removed from all shared projects</li>
              <li>This action cannot be undone</li>
            </ul>
          </div>

          <div>
            <label className='text-secondary-foreground mb-1.5 block text-sm font-medium'>
              Type <span className='text-destructive font-mono font-semibold'>DELETE</span> to
              confirm
            </label>
            <input
              type='text'
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              className='border-border bg-card block w-full max-w-xs rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none'
              placeholder='DELETE'
            />
          </div>

          <div className='flex gap-2'>
            <button
              onClick={handleDelete}
              disabled={deleting || confirmText !== 'DELETE'}
              className='rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-50'
            >
              {deleting ? 'Deleting...' : 'Permanently Delete Account'}
            </button>
            <button
              type='button'
              onClick={() => {
                setShowConfirm(false);
                setConfirmText('');
              }}
              className='bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors'
            >
              Cancel
            </button>
          </div>
        </div>
      : <div className='flex items-center justify-between'>
          <div>
            <h3 className='text-foreground font-medium'>Delete Account</h3>
            <p className='text-muted-foreground mt-0.5 text-sm'>
              Permanently delete your account and all associated data
            </p>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className='border-destructive/20 bg-card text-destructive hover:bg-destructive/10 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-all hover:shadow'
          >
            Delete Account
          </button>
        </div>
      }
    </div>
  );
}
