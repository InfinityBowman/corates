/**
 * Form State Persistence
 * Saves and restores form state across OAuth redirects using IndexedDB.
 * Handles File/ArrayBuffer serialization for PDF uploads.
 */

const DB_NAME = 'corates-form-state';
const DB_VERSION = 1;
const STORE_NAME = 'pendingForms';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Open the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

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
 * Save form state to IndexedDB
 * @param {'createProject' | 'addStudies'} type - Form type
 * @param {Object} data - Form state data (should already be serializable)
 * @param {string} [projectId] - Project ID for add-studies form
 * @returns {Promise<void>}
 */
export async function saveFormState(type, data, projectId) {
  const db = await openDB();
  const key = getKey(type, projectId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record = {
      key,
      type,
      projectId: projectId ?? null,
      data,
      timestamp: Date.now(),
    };

    store.put(record);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };

    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Get saved form state from IndexedDB
 * @param {'createProject' | 'addStudies'} type - Form type
 * @param {string} [projectId] - Project ID for add-studies form
 * @returns {Promise<Object|null>} - The saved data or null if not found/expired
 */
export async function getFormState(type, projectId) {
  const db = await openDB();
  const key = getKey(type, projectId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    let result = null;

    const request = store.get(key);
    request.onerror = () => {
      tx.abort();
    };
    request.onsuccess = () => {
      const record = request.result;

      if (!record || Date.now() - record.timestamp > MAX_AGE_MS) {
        if (record) {
          clearFormState(type, projectId).catch(() => {});
        }
        result = null;
      } else {
        result = record.data;
      }
    };

    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };

    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Clear saved form state from IndexedDB
 * @param {'createProject' | 'addStudies'} type - Form type
 * @param {string} [projectId] - Project ID for add-studies form
 * @returns {Promise<void>}
 */
export async function clearFormState(type, projectId) {
  const db = await openDB();
  const key = getKey(type, projectId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    store.delete(key);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };

    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
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
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const now = Date.now();
    const request = store.openCursor();

    request.onerror = () => {
      tx.abort();
    };

    request.onsuccess = event => {
      const cursor = event.target.result;
      if (cursor) {
        const record = cursor.value;
        if (now - record.timestamp > MAX_AGE_MS) {
          cursor.delete();
        }
        cursor.continue();
      }
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };

    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}
