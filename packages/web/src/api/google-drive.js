/**
 * Google Drive API - Interact with user's connected Google Drive
 */

import { API_BASE } from '@config/api.js';

/**
 * Check if the user has connected their Google account
 * @returns {Promise<{connected: boolean, hasRefreshToken: boolean}>}
 */
export async function getGoogleDriveStatus() {
  const response = await fetch(`${API_BASE}/api/google-drive/status`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to check Google Drive status');
  }

  return response.json();
}

/**
 * Disconnect Google account
 * @returns {Promise<{success: boolean}>}
 */
export async function disconnectGoogleDrive() {
  const response = await fetch(`${API_BASE}/api/google-drive/disconnect`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to disconnect Google account');
  }

  return response.json();
}

/**
 * List PDF files from user's Google Drive
 * @param {Object} options
 * @param {string} [options.pageToken] - Token for pagination
 * @param {number} [options.pageSize] - Number of results (max 100)
 * @param {string} [options.query] - Search query to filter files
 * @returns {Promise<{files: Array, nextPageToken: string|null}>}
 */
export async function listGoogleDriveFiles(options = {}) {
  const params = new URLSearchParams();

  if (options.pageToken) params.set('pageToken', options.pageToken);
  if (options.pageSize) params.set('pageSize', String(options.pageSize));
  if (options.query) params.set('query', options.query);

  const url = `${API_BASE}/api/google-drive/files${params.toString() ? `?${params}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    if (error.code === 'GOOGLE_NOT_CONNECTED') {
      throw new Error('Google account not connected. Please connect your Google account first.');
    }
    if (error.code === 'GOOGLE_TOKEN_EXPIRED') {
      throw new Error('Google session expired. Please reconnect your Google account.');
    }

    throw new Error(error.error || 'Failed to list Google Drive files');
  }

  return response.json();
}

/**
 * Get file metadata from Google Drive
 * @param {string} fileId - The Google Drive file ID
 * @returns {Promise<{file: Object}>}
 */
export async function getGoogleDriveFile(fileId) {
  const response = await fetch(`${API_BASE}/api/google-drive/files/${fileId}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to get file metadata');
  }

  return response.json();
}

/**
 * Import a PDF from Google Drive to a project study
 * @param {string} fileId - The Google Drive file ID
 * @param {string} projectId - The project to import into
 * @param {string} studyId - The study to import into
 * @returns {Promise<{success: boolean, file: Object}>}
 */
export async function importFromGoogleDrive(fileId, projectId, studyId) {
  const response = await fetch(`${API_BASE}/api/google-drive/import`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId, projectId, studyId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    if (error.code === 'GOOGLE_NOT_CONNECTED') {
      throw new Error('Google account not connected. Please connect your Google account first.');
    }
    if (error.code === 'GOOGLE_TOKEN_EXPIRED') {
      throw new Error('Google session expired. Please reconnect your Google account.');
    }

    throw new Error(error.error || 'Failed to import file from Google Drive');
  }

  return response.json();
}

/**
 * Initiate Google OAuth flow to connect Google account
 * This calls the BetterAuth social sign-in endpoint and redirects to Google
 * @param {string} [callbackUrl] - Optional callback URL after auth
 */
export async function connectGoogleAccount(callbackUrl) {
  const response = await fetch(`${API_BASE}/api/auth/sign-in/social`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider: 'google',
      callbackURL: callbackUrl || window.location.href,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to initiate Google sign-in');
  }

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

/**
 * Format date for display
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
