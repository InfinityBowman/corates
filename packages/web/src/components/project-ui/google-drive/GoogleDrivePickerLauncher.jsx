/**
 * GoogleDrivePickerLauncher
 * Shared UI + behavior for launching the Google Picker.
 * Used by both the add-studies flow and the import modal to avoid UI duplication.
 */

import { createEffect, Show } from 'solid-js';
import { createSignal } from 'solid-js';

import {
  getGoogleDriveStatus,
  getGoogleDrivePickerToken,
  connectGoogleAccount,
} from '@/api/google-drive.js';
import { GOOGLE_PICKER_API_KEY, GOOGLE_PICKER_APP_ID } from '@config/google.js';
import { pickGooglePdfFiles } from '@lib/googlePicker.js';

/**
 * @param {Object} props
 * @param {boolean} [props.active=true] - When true, checks connection status
 * @param {boolean} [props.multiselect=false] - Enable multi-select in picker
 * @param {(files: Array<{id: string, name: string}>) => (void|Promise<void>)} [props.onPick] - Called after user picks files
 * @param {() => void} [props.onBeforeOpenPicker] - Called right before opening Google Picker UI (useful to close wrapping dialogs)
 * @param {boolean} [props.disabled=false] - Disable picker button
 * @param {boolean} [props.busy=false] - Show spinner and disable picker button
 */
export default function GoogleDrivePickerLauncher(props) {
  const [loading, setLoading] = createSignal(true);
  const [connected, setConnected] = createSignal(null);
  const [error, setError] = createSignal(null);

  const pickerConfigured = () => !!GOOGLE_PICKER_API_KEY;

  const checkConnectionStatus = async () => {
    setError(null);
    setLoading(true);

    try {
      const status = await getGoogleDriveStatus();
      setConnected(status.connected);
    } catch (err) {
      console.error('Error checking Google Drive status:', err);
      setConnected(false);
      setError('Failed to check Google Drive connection');
    } finally {
      setLoading(false);
    }
  };

  const connect = async callbackUrl => {
    setError(null);
    try {
      await connectGoogleAccount(callbackUrl || window.location.href);
    } catch (err) {
      console.error('Error connecting Google:', err);
      setError(err?.message || 'Failed to connect Google account');
      throw err;
    }
  };

  const openPicker = async options => {
    const multiselect = !!options?.multiselect;

    if (!pickerConfigured()) {
      throw new Error('Google Picker is not configured. Set VITE_GOOGLE_PICKER_API_KEY.');
    }

    if (!connected()) {
      await connect(window.location.href);
      return null;
    }

    setError(null);

    try {
      const { accessToken } = await getGoogleDrivePickerToken();

      return await pickGooglePdfFiles({
        oauthToken: accessToken,
        developerKey: GOOGLE_PICKER_API_KEY,
        appId: GOOGLE_PICKER_APP_ID,
        multiselect,
      });
    } catch (err) {
      const message = err?.message || 'Failed to open Google Picker';
      setError(message);
      throw err;
    }
  };

  createEffect(() => {
    if (props.active === false) return;
    checkConnectionStatus();
  });

  const handleConnectGoogle = async () => {
    try {
      await connect(window.location.href);
    } catch {
      // primitive sets error
    }
  };

  const handleOpenPicker = async () => {
    if (props.disabled || props.busy) return;

    try {
      props.onBeforeOpenPicker?.();
      // Give the UI a tick to remove any wrapping overlays (e.g. Dialog backdrop)
      await new Promise(resolve => setTimeout(resolve, 0));

      const picked = await openPicker({ multiselect: !!props.multiselect });
      if (!picked || picked.length === 0) return;
      await props.onPick?.(picked);
    } catch {
      // primitive sets error
    }
  };

  return (
    <div class='space-y-3'>
      <Show when={!pickerConfigured()}>
        <div class='p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800'>
          Google Picker is not configured. Set VITE_GOOGLE_PICKER_API_KEY.
        </div>
      </Show>

      <Show when={error()}>
        <div class='p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700'>
          {error()}
        </div>
      </Show>

      <Show when={connected() === false}>
        <div class='text-center py-4 px-4 border border-gray-200 rounded-lg'>
          <img src='/logos/drive.svg' alt='Google Drive' class='w-10 h-10 mx-auto mb-3' />
          <h4 class='text-sm font-medium text-gray-900 mb-1'>Connect Google Drive</h4>
          <p class='text-xs text-gray-500 mb-4'>Connect your Google account to select PDFs.</p>
          <button
            type='button'
            onClick={handleConnectGoogle}
            class='inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors'
          >
            <img src='/logos/drive.svg' alt='' class='w-4 h-4' />
            Connect Google Account
          </button>
        </div>
      </Show>

      <Show when={connected()}>
        <button
          type='button'
          onClick={handleOpenPicker}
          disabled={loading() || !!props.disabled || !!props.busy || !pickerConfigured()}
          class='w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 max-w-xl mx-auto'
        >
          <Show
            when={!loading() && !props.busy}
            fallback={
              <div class='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
            }
          />
          <img src='/logos/drive.svg' alt='' class='w-6 h-6 bg-white rounded-sm p-0.5' />
          <span class='text-sm font-medium'>Select from Google Drive</span>
        </button>
      </Show>
    </div>
  );
}
