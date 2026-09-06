/** The Google Drive row of the integrations list. */

import { useState, useEffect, useCallback } from 'react';
import { XIcon } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SettingsRow } from './primitives';
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
import { connectGoogleAccount } from '@/api/google-drive';
import { getDriveStatus, disconnectDrive } from '@/server/functions/google-drive.functions';

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
        const status = await getDriveStatus();
        if (!cancelled) setConnected(status.connected);
      } catch (err) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { toastTitle: 'Could not check your Google Drive connection' });
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
    } catch (err: unknown) {
      const errObj = err as Record<string, unknown>;
      const isAccountConflict =
        (typeof errObj?.message === 'string' && errObj.message.includes('already linked')) ||
        errObj?.code === 'ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER';

      if (isAccountConflict) {
        showToast.error(
          'Google account already in use',
          'That Google account belongs to a different CoRATES user. Use another Google account, or contact support.',
        );
      } else {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { toastTitle: 'Could not connect Google Drive' });
      }
      setConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      await disconnectDrive();
      setConnected(false);
      showToast.success('Disconnected', 'Google Drive is no longer connected.');
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Could not disconnect Google Drive' });
    } finally {
      setDisconnecting(false);
      setConfirmOpen(false);
    }
  }, []);

  return (
    <>
      <SettingsRow
        media={
          <div className='border-border bg-card flex size-9 items-center justify-center rounded-lg border'>
            <img src='/logos/drive.svg' alt='' className='size-4.5' />
          </div>
        }
        label={
          <span className='flex items-center gap-2'>
            Google Drive
            {connected && <Badge variant='success'>Connected</Badge>}
          </span>
        }
        description={
          loading ? 'Checking connection...'
          : connected ?
            'Drive files are available in the PDF picker.'
          : 'Not connected.'
        }
      >
        {!loading &&
          (connected ?
            <Button
              variant='ghost'
              onClick={() => setConfirmOpen(true)}
              disabled={disconnecting}
              className='text-muted-foreground hover:text-destructive hover:bg-destructive/10'
            >
              <XIcon className='size-4' />
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          : <Button variant='outline' onClick={handleConnect} disabled={connecting}>
              {connecting ? 'Connecting...' : 'Connect'}
            </Button>)}
      </SettingsRow>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Drive?</AlertDialogTitle>
            <AlertDialogDescription>
              PDFs you already imported stay in your projects, but you will not be able to import
              new ones until you connect Drive again. This also removes Google as a sign-in method
              on your account.
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
