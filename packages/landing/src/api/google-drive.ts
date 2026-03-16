/**
 * Google Drive API - Interact with user's connected Google Drive
 */

import { apiFetch } from '@/lib/apiFetch';

interface DriveStatus {
  connected: boolean;
  hasRefreshToken: boolean;
}

interface DriveImportResult {
  success: boolean;
  file: Record<string, unknown>;
}

interface PickerToken {
  accessToken: string;
  expiresAt: string | null;
}

export async function getGoogleDriveStatus(): Promise<DriveStatus> {
  return apiFetch.get<DriveStatus>('/api/google-drive/status');
}

export async function disconnectGoogleDrive(): Promise<{ success: boolean }> {
  return apiFetch.delete<{ success: boolean }>('/api/google-drive/disconnect');
}

export async function importFromGoogleDrive(
  fileId: string,
  projectId: string,
  studyId: string,
): Promise<DriveImportResult> {
  return apiFetch.post<DriveImportResult>('/api/google-drive/import', {
    fileId,
    projectId,
    studyId,
  });
}

export async function getGoogleDrivePickerToken(): Promise<PickerToken> {
  return apiFetch.get<PickerToken>('/api/google-drive/picker-token');
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

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return 'Unknown size';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
