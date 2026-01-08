/**
 * Form State Persistence
 * Saves and restores form state across OAuth redirects using Dexie.
 * Handles File/ArrayBuffer serialization for PDF uploads.
 */

import { db } from '@primitives/db.js';

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a storage key based on form type and optional project ID
 * @param {'createProject' | 'addStudies'} type
 * @param {string} [projectId]
 * @returns {string}
 */
function getKey(type, projectId) {
  return projectId ? `${type}:${projectId}` : type;
}

/**
 * Save form state to Dexie
 * @param {'createProject' | 'addStudies'} type - Form type
 * @param {Object} data - Form state data (should already be serializable)
 * @param {string} [projectId] - Project ID for add-studies form
 * @returns {Promise<void>}
 */
export async function saveFormState(type, data, projectId) {
  const key = getKey(type, projectId);

  await db.formStates.put({
    key,
    type,
    projectId: projectId ?? null,
    data,
    timestamp: Date.now(),
  });
}

/**
 * Get saved form state from Dexie
 * @param {'createProject' | 'addStudies'} type - Form type
 * @param {string} [projectId] - Project ID for add-studies form
 * @returns {Promise<Object|null>} - The saved data or null if not found/expired
 */
export async function getFormState(type, projectId) {
  const key = getKey(type, projectId);
  const record = await db.formStates.get(key);

  if (!record) return null;

  if (Date.now() - record.timestamp > MAX_AGE_MS) {
    clearFormState(type, projectId).catch(() => {});
    return null;
  }

  return record.data;
}

/**
 * Clear saved form state from Dexie
 * @param {'createProject' | 'addStudies'} type - Form type
 * @param {string} [projectId] - Project ID for add-studies form
 * @returns {Promise<void>}
 */
export async function clearFormState(type, projectId) {
  const key = getKey(type, projectId);
  await db.formStates.delete(key);
}

/**
 * Check if there is pending form state
 * @param {'createProject' | 'addStudies'} type - Form type
 * @param {string} [projectId] - Project ID for add-studies form
 * @returns {Promise<boolean>}
 */
export async function hasPendingFormState(type, projectId) {
  const state = await getFormState(type, projectId);
  return state !== null;
}

/**
 * Build callback URL with restore state query params
 * @param {'createProject' | 'addStudies'} type - Form type
 * @param {string} [projectId] - Project ID for add-studies form
 * @returns {string}
 */
export function buildRestoreCallbackUrl(type, projectId) {
  const url = new URL(window.location.href);

  // Clear any existing restore params
  url.searchParams.delete('restoreFormState');
  url.searchParams.delete('formProjectId');

  // Add new params
  url.searchParams.set('restoreFormState', type);
  if (projectId) {
    url.searchParams.set('formProjectId', projectId);
  }

  return url.toString();
}

/**
 * Check URL for restore state params
 * @returns {{ type: string, projectId: string | null } | null}
 */
export function getRestoreParamsFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('restoreFormState');

  if (!type) return null;

  return {
    type,
    projectId: params.get('formProjectId'),
  };
}

/**
 * Clear restore state params from URL without navigation
 */
export function clearRestoreParamsFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('restoreFormState');
  url.searchParams.delete('formProjectId');

  window.history.replaceState({}, '', url.toString());
}

/**
 * Clean up all expired form states
 * Call this periodically or on app load
 * @returns {Promise<void>}
 */
export async function cleanupExpiredStates() {
  const expiryThreshold = Date.now() - MAX_AGE_MS;
  await db.formStates.where('timestamp').below(expiryThreshold).delete();
}
