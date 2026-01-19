/**
 * GoogleDriveSettings - Component for managing Google Drive connection in Settings
 */

import { createSignal, onMount, Show } from 'solid-js';
import { FiX } from 'solid-icons/fi';
import { showToast } from '@/components/ui/toast';
import {
  getGoogleDriveStatus,
  disconnectGoogleDrive,
  connectGoogleAccount,
} from '@/api/google-drive.js';

export default function GoogleDriveSettings() {
  const [loading, setLoading] = createSignal(true);
  const [connected, setConnected] = createSignal(false);
  const [disconnecting, setDisconnecting] = createSignal(false);
  const [connecting, setConnecting] = createSignal(false);

  onMount(async () => {
    try {
      const status = await getGoogleDriveStatus();
      setConnected(status.connected);
    } catch (err) {
      console.error('Error checking Google Drive status:', err);
    } finally {
      setLoading(false);
    }
  });

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectGoogleAccount(window.location.href);
    } catch (err) {
      // Provide specific messaging for account linking errors
      const isAccountConflict =
        err?.message?.includes('already linked') ||
        err?.code === 'ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER';

      if (isAccountConflict) {
        showToast.error(
          'Account Conflict',
          'This Google account is already connected to a different user. Please use a different Google account or contact support.',
        );
      } else {
        const { handleError } = await import('@/lib/error-utils.js');
        await handleError(err, {
          toastTitle: 'Connection Failed',
        });
      }
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account?')) {
      return;
    }

    setDisconnecting(true);

    try {
      await disconnectGoogleDrive();
      setConnected(false);
      showToast.success('Disconnected', 'Google account has been disconnected.');
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, {
        toastTitle: 'Error',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div class='flex items-center justify-between'>
      <div class='flex items-center gap-3'>
        <div class='bg-secondary rounded-lg p-2'>
          <img src='/logos/drive.svg' alt='Google Drive' class='h-5 w-5' />
        </div>
        <div>
          <p class='text-foreground font-medium'>Google Drive</p>
          <p class='text-muted-foreground text-sm'>
            {loading() ?
              'Checking connection...'
            : connected() ?
              'Connected - You can import PDFs from your Drive'
            : 'Connect to import PDFs from Google Drive'}
          </p>
        </div>
      </div>

      <Show when={!loading()}>
        <Show
          when={connected()}
          fallback={
            <button
              type='button'
              onClick={handleConnect}
              disabled={connecting()}
              class='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50'
            >
              <img src='/logos/drive.svg' alt='Google Drive' class='h-4 w-4' />
              {connecting() ? 'Connecting...' : 'Connect'}
            </button>
          }
        >
          <div class='flex items-center gap-3'>
            <button
              type='button'
              onClick={handleDisconnect}
              disabled={disconnecting()}
              class='bg-destructive-subtle text-destructive hover:bg-destructive/10 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50'
            >
              <FiX class='h-4 w-4' />
              {disconnecting() ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        </Show>
      </Show>
    </div>
  );
}
