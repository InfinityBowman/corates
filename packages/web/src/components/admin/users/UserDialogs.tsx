import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface BanUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}

export function BanUserDialog({ open, onOpenChange, onConfirm, loading }: BanUserDialogProps) {
  const [banReason, setBanReason] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>Ban User</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col gap-4'>
          <p className='text-muted-foreground text-sm'>
            This will ban the user and revoke all their sessions.
          </p>
          <div>
            <label className='text-secondary-foreground mb-1 block text-sm font-medium'>
              Ban Reason
            </label>
            <textarea
              value={banReason}
              onChange={e => setBanReason(e.target.value)}
              placeholder='Enter reason for ban...'
              className='border-border focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none'
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant='destructive' onClick={() => onConfirm(banReason)} disabled={loading}>
            {loading ? 'Banning...' : 'Ban User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading: boolean;
}

export function DeleteUserDialog({ open, onOpenChange, onConfirm, loading }: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete User</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the user and all their data. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant='destructive' onClick={onConfirm} disabled={loading}>
            {loading ? 'Processing...' : 'Delete User'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RevokeAllSessionsDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke All Sessions</AlertDialogTitle>
          <AlertDialogDescription>
            This will revoke all active sessions for this user. They will need to sign in again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant='destructive' onClick={onConfirm} disabled={loading}>
            {loading ? 'Processing...' : 'Revoke All'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
