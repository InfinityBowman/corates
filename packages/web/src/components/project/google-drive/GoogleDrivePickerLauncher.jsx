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
import { buildRestoreCallbackUrl } from '@lib/formStatePersistence.js';

/**
 * @param {Object} props
 * @param {boolean} [props.active=true] - When true, checks connection status
 * @param {boolean} [props.multiselect=false] - Enable multi-select in picker
 * @param {(files: Array<{id: string, name: string}>) => (void|Promise<void>)} [props.onPick] - Called after user picks files
 * @param {() => void} [props.onBeforeOpenPicker] - Called right before opening Google Picker UI (useful to close wrapping dialogs)
 * @param {boolean} [props.disabled=false] - Disable picker button
 * @param {boolean} [props.busy=false] - Show spinner and disable picker button
 * @param {'createProject' | 'addStudies'} [props.formType] - Form type for state persistence
 * @param {string} [props.projectId] - Project ID (for addStudies form type)
 * @param {() => Promise<void>} [props.onSaveFormState] - Called before OAuth redirect to save form state
 */
export default function GoogleDrivePickerLauncher(props) {
  const [loading, setLoading] = createSignal(true);
  const [connected, setConnected] = createSignal(null);
  const [error, setError] = createSignal(null);
  // eslint-disable-next-line solid/reactivity
  let studyId = props.studyId;

  const pickerConfigured = () => !!GOOGLE_PICKER_API_KEY;

  const checkConnectionStatus = async () => {
    setError(null);
    setLoading(true);

    try {
      const status = await getGoogleDriveStatus();
      setConnected(status.connected);
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, {
        setError,
        showToast: false,
      });
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const connect = async () => {
    setError(null);
    try {
      // Save form state before OAuth redirect if handler provided
      if (props.onSaveFormState) {
        await props.onSaveFormState();
      }

      // Build callback URL with restore params if form type is provided
      let callbackUrl = window.location.href;
      if (props.formType) {
        callbackUrl = buildRestoreCallbackUrl(props.formType, props.projectId);
      }

      await connectGoogleAccount(callbackUrl);
    } catch (err) {
      // Provide specific messaging for account linking errors
      const isAccountConflict =
        err?.message?.includes('already linked') ||
        err?.code === 'ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER';

      if (isAccountConflict) {
        setError(
          'This Google account is already connected to a different user. Please use a different Google account.',
        );
      } else {
        const { handleError } = await import('@/lib/error-utils.js');
        await handleError(err, {
          setError,
          showToast: false,
        });
      }
      throw err;
    }
  };

  const openPicker = async options => {
    const multiselect = !!options?.multiselect;

    if (!pickerConfigured()) {
      throw new Error('Google Picker is not configured. Set VITE_GOOGLE_PICKER_API_KEY.');
    }

    if (!connected()) {
      await connect();
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
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, {
        setError,
        showToast: false,
      });
      throw err;
    }
  };

  createEffect(() => {
    if (props.active === false) return;
    checkConnectionStatus();
  });

  const handleConnectGoogle = async () => {
    try {
      await connect();
    } catch (err) {
      console.warn('Google Drive connect failed:', err.message);
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
      await props.onPick?.(picked, studyId);
    } catch (err) {
      console.warn('Google Drive picker failed:', err.message);
    }
  };

  return (
    <div class='space-y-3'>
      <Show when={!pickerConfigured()}>
        <div class='rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800'>
          Google Picker is not configured. Set VITE_GOOGLE_PICKER_API_KEY.
        </div>
      </Show>

      <Show when={error()}>
        <div class='rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
          {error()}
        </div>
      </Show>

      <Show when={connected() === false}>
        <div class='border-border rounded-lg border px-4 py-4 text-center'>
          <img src='/logos/drive.svg' alt='Google Drive' class='mx-auto mb-3 h-10 w-10' />
          <h4 class='text-foreground mb-1 text-sm font-medium'>Connect Google Drive</h4>
          <p class='text-muted-foreground mb-4 text-xs'>
            Connect your Google account to select PDFs.
          </p>
          <button
            type='button'
            onClick={handleConnectGoogle}
            class='bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors'
          >
            <img src='/logos/drive.svg' alt='' class='h-4 w-4' />
            Connect Google Account
          </button>
        </div>
      </Show>

      <Show when={connected()}>
        <button
          type='button'
          onClick={handleOpenPicker}
          disabled={loading() || !!props.disabled || !!props.busy || !pickerConfigured()}
          class='bg-primary hover:bg-primary/90 mx-auto flex w-full max-w-xl items-center justify-center gap-2 rounded-lg px-4 py-3 text-white transition-colors disabled:opacity-50'
        >
          <Show
            when={!loading() && !props.busy}
            fallback={
              <div class='h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent' />
            }
          />
          <img src='/logos/drive.svg' alt='' class='h-6 w-6 rounded-sm bg-white p-0.5' />
          <span class='text-sm font-medium'>Select from Google Drive</span>
        </button>
      </Show>
    </div>
  );
}
