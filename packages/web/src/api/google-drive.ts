/**
 * Google Drive API - Interact with user's connected Google Drive
 */

import { apiFetch } from '@/lib/apiFetch';
import { API_BASE } from '@/config/api';

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; code?: string };
  if (!res.ok) {
    const err = new Error(
      (data && (data.message || data.code)) || `${init.method || 'GET'} ${path} failed: ${res.status}`,
    );
    (err as unknown as { response?: unknown }).response = data;
    throw err;
  }
  return data;
}

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
  return request<DriveStatus>('/api/google-drive/status');
}

export async function disconnectGoogleDrive() {
  return request<DisconnectSuccess>('/api/google-drive/disconnect', { method: 'DELETE' });
}

export async function importFromGoogleDrive(fileId: string, projectId: string, studyId: string) {
  return request<ImportSuccess>('/api/google-drive/import', {
    method: 'POST',
    body: JSON.stringify({ fileId, projectId, studyId }),
  });
}

export async function getGoogleDrivePickerToken() {
  return request<PickerToken>('/api/google-drive/picker-token');
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
