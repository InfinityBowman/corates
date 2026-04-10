/**
 * Google Drive API - Interact with user's connected Google Drive
 */

import { parseResponse } from 'hono/client';
import { apiFetch } from '@/lib/apiFetch';
import { api } from '@/lib/rpc';

export async function getGoogleDriveStatus() {
  return parseResponse(api.api['google-drive'].status.$get());
}

export async function disconnectGoogleDrive() {
  return parseResponse(api.api['google-drive'].disconnect.$delete());
}

export async function importFromGoogleDrive(fileId: string, projectId: string, studyId: string) {
  return parseResponse(
    api.api['google-drive'].import.$post({ json: { fileId, projectId, studyId } }),
  );
}

export async function getGoogleDrivePickerToken() {
  return parseResponse(api.api['google-drive']['picker-token'].$get());
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
