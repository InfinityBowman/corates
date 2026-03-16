/**
 * GoogleDriveSettings - Component for managing Google Drive connection
 */

import { useState, useEffect, useCallback } from 'react';
import { XIcon } from 'lucide-react';
import { showToast } from '@/components/ui/toast';
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
import {
  getGoogleDriveStatus,
  disconnectGoogleDrive,
  connectGoogleAccount,
} from '@/api/google-drive';

export function GoogleDriveSettings() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await getGoogleDriveStatus();
        if (!cancelled) setConnected(status.connected);
      } catch (err) {
        console.error('Error checking Google Drive status:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      await connectGoogleAccount(window.location.href);
    } catch (err: any) {
      const isAccountConflict =
        err?.message?.includes('already linked') ||
        err?.code === 'ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER';

      if (isAccountConflict) {
        showToast.error(
          'Account Conflict',
          'This Google account is already connected to a different user. Please use a different Google account or contact support.',
        );
      } else {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { toastTitle: 'Connection Failed' });
      }
      setConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      await disconnectGoogleDrive();
      setConnected(false);
      showToast.success('Disconnected', 'Google account has been disconnected.');
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Error' });
    } finally {
      setDisconnecting(false);
      setConfirmOpen(false);
    }
  }, []);

  return (
    <>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <div className='bg-secondary rounded-lg p-2'>
            <img src='/logos/drive.svg' alt='Google Drive' className='h-5 w-5' />
          </div>
          <div>
            <p className='text-foreground font-medium'>Google Drive</p>
            <p className='text-muted-foreground text-sm'>
              {loading ?
                'Checking connection...'
              : connected ?
                'Connected - You can import PDFs from your Drive'
              : 'Connect to import PDFs from Google Drive'}
            </p>
          </div>
        </div>

        {!loading &&
          (connected ?
            <button
              type='button'
              onClick={() => setConfirmOpen(true)}
              disabled={disconnecting}
              className='text-destructive hover:bg-destructive/10 inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50'
            >
              <XIcon className='h-4 w-4' />
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          : <button
              type='button'
              onClick={handleConnect}
              disabled={connecting}
              className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50'
            >
              <img src='/logos/drive.svg' alt='Google Drive' className='h-4 w-4' />
              {connecting ? 'Connecting...' : 'Connect'}
            </button>)}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Drive?</AlertDialogTitle>
            <AlertDialogDescription>
              You won&apos;t be able to import PDFs from Google Drive until you reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              disabled={disconnecting}
              onClick={handleDisconnect}
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
