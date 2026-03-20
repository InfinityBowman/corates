/**
 * GoogleDrivePickerLauncher
 * Shared UI + behavior for launching the Google Picker.
 * Used by both the add-studies flow and the import modal.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getGoogleDriveStatus,
  getGoogleDrivePickerToken,
  connectGoogleAccount,
} from '@/api/google-drive';
import { Alert } from '@/components/ui/alert';
import { GOOGLE_PICKER_API_KEY, GOOGLE_PICKER_APP_ID } from '@/config/google';
import { pickGooglePdfFiles } from '@/lib/googlePicker.js';
import { buildRestoreCallbackUrl } from '@/lib/formStatePersistence.js';

/* eslint-disable no-unused-vars */
interface GoogleDrivePickerLauncherProps {
  active?: boolean;
  multiselect?: boolean;
  onPick?: (files: Array<{ id: string; name: string }>, studyId?: string) => void | Promise<void>;
  onBeforeOpenPicker?: () => void;
  disabled?: boolean;
  busy?: boolean;
  formType?: 'createProject' | 'addStudies';
  projectId?: string;
  studyId?: string;
  onSaveFormState?: () => Promise<void>;
}
/* eslint-enable no-unused-vars */

export function GoogleDrivePickerLauncher({
  active = true,
  multiselect = false,
  onPick,
  onBeforeOpenPicker,
  disabled = false,
  busy = false,
  formType,
  projectId,
  studyId,
  onSaveFormState,
}: GoogleDrivePickerLauncherProps) {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Capture studyId at mount time (stable across renders)
  const studyIdRef = useRef(studyId);

  const pickerConfigured = !!GOOGLE_PICKER_API_KEY;

  const checkConnectionStatus = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const status = await getGoogleDriveStatus();
      setConnected(status.connected);
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, { setError: (msg: string) => setError(msg), showToast: false });
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    try {
      if (onSaveFormState) {
        await onSaveFormState();
      }

      let callbackUrl = window.location.href;
      if (formType) {
        callbackUrl = buildRestoreCallbackUrl(formType, projectId);
      }

      await connectGoogleAccount(callbackUrl);
    } catch (err: any) {
      const isAccountConflict =
        err?.message?.includes('already linked') ||
        err?.code === 'ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER';

      if (isAccountConflict) {
        setError(
          'This Google account is already connected to a different user. Please use a different Google account.',
        );
      } else {
        const { handleError } = await import('@/lib/error-utils.js');
        await handleError(err, { setError: (msg: string) => setError(msg), showToast: false });
      }
      throw err;
    }
  }, [onSaveFormState, formType, projectId]);

  const openPicker = useCallback(
    async (opts?: { multiselect?: boolean }) => {
      const multi = !!opts?.multiselect;

      if (!pickerConfigured) {
        throw new Error('Google Picker is not configured. Set VITE_GOOGLE_PICKER_API_KEY.');
      }

      if (!connected) {
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
          multiselect: multi,
        });
      } catch (err) {
        const { handleError } = await import('@/lib/error-utils.js');
        await handleError(err, { setError: (msg: string) => setError(msg), showToast: false });
        throw err;
      }
    },
    [pickerConfigured, connected, connect],
  );

  // Check connection status on mount
  useEffect(() => {
    if (!active) return;
    checkConnectionStatus();
  }, [active, checkConnectionStatus]);

  const handleConnectGoogle = useCallback(async () => {
    try {
      await connect();
    } catch (err: any) {
      console.warn('Google Drive connect failed:', err.message);
    }
  }, [connect]);

  const handleOpenPicker = useCallback(async () => {
    if (disabled || busy) return;
    try {
      onBeforeOpenPicker?.();
      // Give the UI a tick to remove any wrapping overlays
      await new Promise(resolve => setTimeout(resolve, 0));

      const picked = await openPicker({ multiselect });
      if (!picked || picked.length === 0) return;
      await onPick?.(picked, studyIdRef.current);
    } catch (err: any) {
      console.warn('Google Drive picker failed:', err.message);
    }
  }, [disabled, busy, onBeforeOpenPicker, openPicker, multiselect, onPick]);

  return (
    <div className='space-y-3'>
      {!pickerConfigured && (
        <Alert variant='warning'>
          Google Picker is not configured. Set VITE_GOOGLE_PICKER_API_KEY.
        </Alert>
      )}

      {error && (
        <Alert variant='destructive'>
          {error}
        </Alert>
      )}

      {connected === false && (
        <div className='border-border rounded-lg border px-4 py-4 text-center'>
          <img src='/logos/drive.svg' alt='Google Drive' className='mx-auto mb-3 size-10' />
          <h4 className='text-foreground mb-1 text-sm font-medium'>Connect Google Drive</h4>
          <p className='text-muted-foreground mb-4 text-xs'>
            Connect your Google account to select PDFs.
          </p>
          <button
            type='button'
            onClick={handleConnectGoogle}
            className='bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors'
          >
            <img src='/logos/drive.svg' alt='' className='size-4' />
            Connect Google Account
          </button>
        </div>
      )}

      {connected && (
        <button
          type='button'
          onClick={handleOpenPicker}
          disabled={loading || disabled || busy || !pickerConfigured}
          className='bg-primary hover:bg-primary/90 mx-auto flex w-full max-w-xl items-center justify-center gap-2 rounded-lg px-4 py-3 text-white transition-colors disabled:opacity-50'
        >
          {(loading || busy) && (
            <div className='size-4 animate-spin rounded-full border-2 border-white border-t-transparent' />
          )}
          <img src='/logos/drive.svg' alt='' className='size-6 rounded-sm bg-white p-0.5' />
          <span className='text-sm font-medium'>Select from Google Drive</span>
        </button>
      )}
    </div>
  );
}
