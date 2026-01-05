/**
 * Google Drive API - Interact with user's connected Google Drive
 *
 * Import endpoint uses org-scoped route: /api/orgs/:orgId/google-drive/import
 */

import { API_BASE } from '@config/api.js';
import { handleFetchError } from '@/lib/error-utils.js';

/**
 * Check if the user has connected their Google account
 * @returns {Promise<{connected: boolean, hasRefreshToken: boolean}>}
 */
export async function getGoogleDriveStatus() {
  const response = await handleFetchError(
    fetch(`${API_BASE}/api/google-drive/status`, {
      method: 'GET',
      credentials: 'include',
    }),
  );

  return response.json();
}

/**
 * Disconnect Google account
 * @returns {Promise<{success: boolean}>}
 */
export async function disconnectGoogleDrive() {
  const response = await handleFetchError(
    fetch(`${API_BASE}/api/google-drive/disconnect`, {
      method: 'DELETE',
      credentials: 'include',
    }),
  );

  return response.json();
}

/**
 * Import a PDF from Google Drive to a project study
 * @param {string} fileId - The Google Drive file ID
 * @param {string} orgId - The organization ID
 * @param {string} projectId - The project to import into
 * @param {string} studyId - The study to import into
 * @returns {Promise<{success: boolean, file: Object}>}
 */
export async function importFromGoogleDrive(fileId, orgId, projectId, studyId) {
  const url = `${API_BASE}/api/orgs/${orgId}/google-drive/import`;

  const response = await handleFetchError(
    fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId, projectId, studyId }),
    }),
  );

  return response.json();
}

/**
 * Get a short-lived Google access token suitable for the Google Picker API.
 * @returns {Promise<{accessToken: string, expiresAt: string|null}>}
 */
export async function getGoogleDrivePickerToken() {
  const response = await handleFetchError(
    fetch(`${API_BASE}/api/google-drive/picker-token`, {
      method: 'GET',
      credentials: 'include',
    }),
  );

  return response.json();
}

/**
 * Initiate Google OAuth flow to connect Google account
 * This calls the BetterAuth social sign-in endpoint and redirects to Google
 * @param {string} [callbackUrl] - Optional callback URL after auth
 */
export async function connectGoogleAccount(callbackUrl) {
  const response = await handleFetchError(
    fetch(`${API_BASE}/api/auth/sign-in/social`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'google',
        callbackURL: callbackUrl || window.location.href,
      }),
    }),
  );

  const data = await response.json();

  // BetterAuth returns { url, redirect: true } - we need to redirect to the URL
  if (data.url) {
    window.location.href = data.url;
  } else {
    throw new Error('No redirect URL received from auth server');
  }
}

/**
 * @deprecated Use connectGoogleAccount() instead
 */
export function getGoogleConnectUrl(callbackUrl) {
  console.warn('getGoogleConnectUrl is deprecated, use connectGoogleAccount() instead');
  const params = new URLSearchParams({
    provider: 'google',
  });

  if (callbackUrl) {
    params.set('callbackURL', callbackUrl);
  }

  return `${API_BASE}/api/auth/sign-in/social?${params}`;
}

/**
 * Format file size for display
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
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
