import { apiFetch } from '@/lib/apiFetch';
import {
  getDriveStatus,
  disconnectDrive,
  getDrivePickerToken,
  importFromDrive,
} from '@/server/functions/google-drive.functions';

interface DriveStatus {
  connected: boolean;
  hasRefreshToken: boolean;
}

interface PickerToken {
  accessToken: string;
  expiresAt: string | null;
}

interface DisconnectSuccess {
  success: true;
  message: string;
}

interface ImportSuccess {
  success: true;
  id: string;
  file: {
    key: string;
    fileName: string;
    originalFileName?: string;
    size: number;
    source: 'google-drive';
  };
}

export async function getGoogleDriveStatus() {
  return getDriveStatus() as Promise<DriveStatus>;
}

export async function disconnectGoogleDrive() {
  return disconnectDrive() as Promise<DisconnectSuccess>;
}

export async function importFromGoogleDrive(fileId: string, projectId: string, studyId: string) {
  return importFromDrive({
    data: { fileId, projectId, studyId },
  }) as Promise<ImportSuccess>;
}

export async function getGoogleDrivePickerToken() {
  return getDrivePickerToken() as Promise<PickerToken>;
}

export async function connectGoogleAccount(callbackUrl?: string): Promise<void> {
  const data = await apiFetch.post<{ url?: string }>('/api/auth/link-social', {
    provider: 'google',
    callbackURL: callbackUrl || window.location.href,
  });

  if (data.url) {
    window.location.href = data.url;
  } else {
    throw new Error('No redirect URL received from auth server');
  }
}
