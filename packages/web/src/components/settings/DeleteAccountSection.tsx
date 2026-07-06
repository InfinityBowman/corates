/**
 * DeleteAccountSection - Danger zone with account deletion confirmation
 */

import { useState, useCallback, useId } from 'react';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { showToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function DeleteAccountSection() {
  const user = useAuthStore(selectUser);
  const deleteAccount = useAuthStore(s => s.deleteAccount);
  const confirmId = useId();

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
            <Label htmlFor={confirmId} className='mb-1.5 block'>
              Type <span className='text-destructive font-mono font-semibold'>DELETE</span> to
              confirm
            </Label>
            <Input
              id={confirmId}
              type='text'
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              className='focus-visible:border-destructive focus-visible:ring-destructive/20 max-w-xs'
              placeholder='DELETE'
            />
          </div>

          <div className='flex gap-2'>
            <Button
              variant='destructive'
              onClick={handleDelete}
              disabled={deleting || confirmText !== 'DELETE'}
            >
              {deleting ? 'Deleting...' : 'Permanently Delete Account'}
            </Button>
            <Button
              variant='secondary'
              onClick={() => {
                setShowConfirm(false);
                setConfirmText('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      : <div className='flex items-center justify-between'>
          <div>
            <h3 className='text-foreground font-medium'>Delete Account</h3>
            <p className='text-muted-foreground mt-0.5 text-sm'>
              Permanently delete your account and all associated data
            </p>
          </div>
          <Button
            variant='outline'
            onClick={() => setShowConfirm(true)}
            className='border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive'
          >
            Delete Account
          </Button>
        </div>
      }
    </div>
  );
}
