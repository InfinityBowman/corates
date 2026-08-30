/** Account deletion, confirmed in a dialog. */

import { useState, useCallback, useId } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SettingsSection, SettingsRow } from './primitives';

const CONSEQUENCES = [
  'All your projects are permanently deleted',
  'All your checklists and reviews are lost',
  'You are removed from every shared project',
];

export function DeleteAccountSection() {
  const user = useAuthStore(selectUser);
  const deleteAccount = useAuthStore(s => s.deleteAccount);
  const confirmId = useId();

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (confirmText !== 'DELETE') return;

    setDeleting(true);
    try {
      await deleteAccount();
      showToast.success('Account deleted', 'Your account has been deleted.');
      window.location.href = '/';
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Delete Failed' });
      setDeleting(false);
    }
  }, [confirmText, deleteAccount]);

  if (!user) return null;

  return (
    <>
      <SettingsSection title='Danger zone' icon={TriangleAlertIcon} tone='destructive'>
        <SettingsRow
          label='Delete account'
          description='Permanently delete your account and everything in it. This cannot be undone.'
        >
          <Button variant='destructive' onClick={() => setOpen(true)}>
            Delete account
          </Button>
        </SettingsRow>
      </SettingsSection>

      <AlertDialog
        open={open}
        onOpenChange={next => {
          if (deleting) return;
          setOpen(next);
          if (!next) setConfirmText('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This is permanent. There is no way to restore your account or its data.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ul className='text-muted-foreground flex flex-col gap-1.5 text-sm'>
            {CONSEQUENCES.map(item => (
              <li key={item} className='flex gap-2'>
                <span aria-hidden className='text-destructive'>
                  -
                </span>
                {item}
              </li>
            ))}
          </ul>

          <div className='flex flex-col gap-1.5'>
            <Label htmlFor={confirmId}>
              Type <span className='text-destructive font-mono font-semibold'>DELETE</span> to
              confirm
            </Label>
            <Input
              id={confirmId}
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              className='focus-visible:border-destructive focus-visible:ring-destructive/20'
              placeholder='DELETE'
              autoComplete='off'
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              disabled={deleting || confirmText !== 'DELETE'}
              onClick={e => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {deleting ? 'Deleting...' : 'Delete account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
