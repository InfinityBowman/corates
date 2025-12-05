/**
 * GoogleDriveSettings - Component for managing Google Drive connection in Settings
 */

import { createSignal, onMount, Show } from 'solid-js';
import { FaBrandsGoogleDrive } from 'solid-icons/fa';
import { FiX } from 'solid-icons/fi';
import { showToast } from '@components/zag/Toast.jsx';
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
      console.error('Error connecting Google:', err);
      showToast.error('Error', 'Failed to connect Google account.');
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
      console.error('Error disconnecting Google:', err);
      showToast.error('Error', 'Failed to disconnect Google account.');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div class='flex items-center justify-between'>
      <div class='flex items-center gap-3'>
        <div class='p-2 bg-gray-100 rounded-lg'>
          <FaBrandsGoogleDrive class='w-5 h-5 text-gray-600' />
        </div>
        <div>
          <p class='font-medium text-gray-900'>Google Drive</p>
          <p class='text-sm text-gray-500'>
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
              class='inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50'
            >
              <FaBrandsGoogleDrive class='w-4 h-4' />
              {connecting() ? 'Connecting...' : 'Connect'}
            </button>
          }
        >
          <div class='flex items-center gap-3'>
            <button
              type='button'
              onClick={handleDisconnect}
              disabled={disconnecting()}
              class='inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50'
            >
              <FiX class='w-4 h-4' />
              {disconnecting() ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        </Show>
      </Show>
    </div>
  );
}
