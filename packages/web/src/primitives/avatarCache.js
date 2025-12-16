/**
 * avatarCache - Local caching layer for user avatars
 *
 * This provides offline access to avatar images by storing them in IndexedDB.
 * When online, avatars are fetched from the API and cached locally.
 * When offline, the cached version is used.
 */

import { API_BASE } from '@config/api.js';

const DB_NAME = 'corates-avatar-cache';
const DB_VERSION = 1;
const AVATAR_STORE_NAME = 'avatars';

// Shared database instance and initialization promise
let dbInstance = null;
let dbInitPromise = null;

/**
 * Open the IndexedDB database (singleton pattern)
 */
function openDatabase() {
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(AVATAR_STORE_NAME)) {
        const store = db.createObjectStore(AVATAR_STORE_NAME, { keyPath: 'userId' });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
      }
    };
  });

  return dbInitPromise;
}

/**
 * Get database instance
 */
async function getDb() {
  if (dbInstance) return dbInstance;
  return openDatabase();
}

/**
 * Convert a blob to a base64 data URL
 */
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Get a cached avatar for a user
 * @param {string} userId - The user ID
 * @returns {Promise<string|null>} - Data URL of the avatar or null if not cached
 */
export async function getCachedAvatar(userId) {
  if (!userId) return null;

  try {
    const db = await getDb();
    const tx = db.transaction(AVATAR_STORE_NAME, 'readonly');
    const store = tx.objectStore(AVATAR_STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(userId);
      request.onsuccess = () => {
        const result = request.result;
        if (result?.dataUrl) {
          resolve(result.dataUrl);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error getting cached avatar:', err);
    return null;
  }
}

/**
 * Cache an avatar for a user
 * @param {string} userId - The user ID
 * @param {string} dataUrl - The data URL of the avatar image
 */
export async function cacheAvatar(userId, dataUrl) {
  if (!userId || !dataUrl) return;

  try {
    const db = await getDb();
    const tx = db.transaction(AVATAR_STORE_NAME, 'readwrite');
    const store = tx.objectStore(AVATAR_STORE_NAME);

    await new Promise((resolve, reject) => {
      const request = store.put({
        userId,
        dataUrl,
        cachedAt: Date.now(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error caching avatar:', err);
  }
}

/**
 * Remove a cached avatar
 * @param {string} userId - The user ID
 */
export async function removeCachedAvatar(userId) {
  if (!userId) return;

  try {
    const db = await getDb();
    const tx = db.transaction(AVATAR_STORE_NAME, 'readwrite');
    const store = tx.objectStore(AVATAR_STORE_NAME);

    await new Promise((resolve, reject) => {
      const request = store.delete(userId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error removing cached avatar:', err);
  }
}

/**
 * Fetch an avatar from the API and cache it
 * @param {string} userId - The user ID
 * @param {string} imageUrl - The avatar URL (can be relative or absolute)
 * @returns {Promise<string|null>} - Data URL of the avatar or null if failed
 */
export async function fetchAndCacheAvatar(userId, imageUrl) {
  if (!userId || !imageUrl) return null;

  try {
    // Build the full URL - handle both relative and absolute URLs
    let fullUrl = imageUrl;
    const isRelativeUrl = imageUrl.startsWith('/');
    if (isRelativeUrl) {
      fullUrl = `${API_BASE}${imageUrl}`;
    }

    // Only include credentials for our API (relative URLs), not for external URLs (e.g., Google avatars)
    // External URLs like lh3.googleusercontent.com don't allow credentials with CORS
    const fetchOptions = isRelativeUrl ? { credentials: 'include' } : {};

    const response = await fetch(fullUrl, fetchOptions);

    if (!response.ok) {
      console.warn('Failed to fetch avatar:', response.status);
      return null;
    }

    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);

    // Cache the avatar
    await cacheAvatar(userId, dataUrl);

    return dataUrl;
  } catch (err) {
    console.error('Error fetching avatar:', err);
    return null;
  }
}

/**
 * Get avatar with automatic caching
 * Returns cached version if available and offline, otherwise fetches and caches
 * @param {string} userId - The user ID
 * @param {string} imageUrl - The avatar URL from user profile
 * @returns {Promise<string|null>} - Data URL of the avatar or null
 */
export async function getAvatarWithCache(userId, imageUrl) {
  if (!userId) return null;

  // If no image URL, just check cache (for offline scenarios)
  if (!imageUrl) {
    return getCachedAvatar(userId);
  }

  // If offline, return cached version
  if (!navigator.onLine) {
    return getCachedAvatar(userId);
  }

  // Online: fetch and cache, falling back to cache on error
  try {
    const dataUrl = await fetchAndCacheAvatar(userId, imageUrl);
    return dataUrl;
  } catch {
    // If fetch fails, try to return cached version
    return getCachedAvatar(userId);
  }
}

/**
 * Clear all cached avatars (e.g., on logout)
 */
export async function clearAvatarCache() {
  try {
    const db = await getDb();
    const tx = db.transaction(AVATAR_STORE_NAME, 'readwrite');
    const store = tx.objectStore(AVATAR_STORE_NAME);

    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error clearing avatar cache:', err);
  }
}
