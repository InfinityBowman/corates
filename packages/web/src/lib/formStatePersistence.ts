/**
 * Form State Persistence
 * Saves and restores form state across OAuth redirects using Dexie.
 * Handles File/ArrayBuffer serialization for PDF uploads.
 */

import { db } from '@/primitives/db.js';
import { bestEffort } from '@/lib/errorLogger.js';

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

type FormType = 'createProject' | 'addStudies';

/**
 * Generate a storage key based on form type and optional project ID
 */
function getKey(type: FormType, projectId?: string): string {
  return projectId ? `${type}:${projectId}` : type;
}

/**
 * Save form state to Dexie
 */
export async function saveFormState(
  type: FormType,
  data: unknown,
  projectId?: string,
): Promise<void> {
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
 */
export async function getFormState(type: FormType, projectId?: string): Promise<unknown | null> {
  const key = getKey(type, projectId);
  const record = await db.formStates.get(key);

  if (!record) return null;

  if (Date.now() - record.timestamp > MAX_AGE_MS) {
    bestEffort(clearFormState(type, projectId), {
      operation: 'clearExpiredFormState',
      type,
      projectId,
    });
    return null;
  }

  return record.data;
}

/**
 * Clear saved form state from Dexie
 */
export async function clearFormState(type: FormType, projectId?: string): Promise<void> {
  const key = getKey(type, projectId);
  await db.formStates.delete(key);
}

/**
 * Check if there is pending form state
 */
export async function hasPendingFormState(type: FormType, projectId?: string): Promise<boolean> {
  const state = await getFormState(type, projectId);
  return state !== null;
}

/**
 * Build callback URL with restore state query params
 */
export function buildRestoreCallbackUrl(type: FormType, projectId?: string): string {
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

interface RestoreParams {
  type: string;
  projectId: string | null;
}

/**
 * Check URL for restore state params
 */
export function getRestoreParamsFromUrl(): RestoreParams | null {
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
export function clearRestoreParamsFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('restoreFormState');
  url.searchParams.delete('formProjectId');

  window.history.replaceState({}, '', url.toString());
}

/**
 * Clean up all expired form states
 * Call this periodically or on app load
 */
export async function cleanupExpiredStates(): Promise<void> {
  const expiryThreshold = Date.now() - MAX_AGE_MS;
  await db.formStates.where('timestamp').below(expiryThreshold).delete();
}
