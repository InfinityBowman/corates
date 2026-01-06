/**
 * Google Drive API - Interact with user's connected Google Drive
 *
 * Import endpoint uses org-scoped route: /api/orgs/:orgId/google-drive/import
 */

import { apiFetch } from '@/lib/apiFetch.js';

/**
 * Check if the user has connected their Google account
 * @returns {Promise<{connected: boolean, hasRefreshToken: boolean}>}
 */
export async function getGoogleDriveStatus() {
  return apiFetch.get('/api/google-drive/status');
}

/**
 * Disconnect Google account
 * @returns {Promise<{success: boolean}>}
 */
export async function disconnectGoogleDrive() {
  return apiFetch.delete('/api/google-drive/disconnect');
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
  const url = `/api/orgs/${orgId}/google-drive/import`;

  return apiFetch.post(url, { fileId, projectId, studyId });
}

/**
 * Get a short-lived Google access token suitable for the Google Picker API.
 * @returns {Promise<{accessToken: string, expiresAt: string|null}>}
 */
export async function getGoogleDrivePickerToken() {
  return apiFetch.get('/api/google-drive/picker-token');
}

/**
 * Initiate Google OAuth flow to connect Google account
 * This calls the BetterAuth social sign-in endpoint and redirects to Google
 * @param {string} [callbackUrl] - Optional callback URL after auth
 */
export async function connectGoogleAccount(callbackUrl) {
  const data = await apiFetch.post('/api/auth/sign-in/social', {
    provider: 'google',
    callbackURL: callbackUrl || window.location.href,
  });

  // BetterAuth returns { url, redirect: true } - we need to redirect to the URL
  if (data.url) {
    window.location.href = data.url;
  } else {
    throw new Error('No redirect URL received from auth server');
  }
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
