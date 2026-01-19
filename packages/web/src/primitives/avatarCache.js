/**
 * avatarCache - Local caching layer for user avatars
 *
 * This provides offline access to avatar images by storing them in Dexie.
 * When online, avatars are fetched from the API and cached locally.
 * When offline, the cached version is used.
 *
 * All avatars are now served from our R2 storage via the API, so external URL
 * handling has been removed. OAuth provider avatars (Google, etc.) are copied
 * to R2 on user signup.
 */

import { API_BASE } from '@config/api.js';
import { compressImageBlob } from '@lib/imageUtils.js';
import { db } from './db.js';

// Cache expiry: 30 days in milliseconds
const CACHE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

// Maximum avatar size before compression (500KB)
const MAX_AVATAR_SIZE = 500 * 1024;

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
    const record = await db.avatars.get(userId);
    return record?.dataUrl ?? null;
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
    await db.avatars.put({
      userId,
      dataUrl,
      cachedAt: Date.now(),
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
    await db.avatars.delete(userId);
  } catch (err) {
    console.error('Error removing cached avatar:', err);
  }
}

/**
 * Fetch an avatar from the API and cache it
 * All avatars are now served from our API (R2 storage), so we always use
 * credentials and don't need external URL handling.
 *
 * @param {string} userId - The user ID
 * @param {string} imageUrl - The avatar URL (relative path like /api/users/avatar/{userId})
 * @returns {Promise<string|null>} - Data URL of the avatar or null if failed
 */
export async function fetchAndCacheAvatar(userId, imageUrl) {
  if (!userId || !imageUrl) return null;

  try {
    // Build the full URL from relative path
    const fullUrl = imageUrl.startsWith('/') ? `${API_BASE}${imageUrl}` : imageUrl;

    const response = await fetch(fullUrl, { credentials: 'include' });

    if (!response.ok) {
      console.warn('Failed to fetch avatar:', response.status);
      return null;
    }

    let blob = await response.blob();

    // Compress large avatars before caching
    if (blob.size > MAX_AVATAR_SIZE) {
      try {
        blob = await compressImageBlob(blob, { maxSize: 256, quality: 0.85 });
      } catch (err) {
        console.warn('Failed to compress avatar, caching original:', err);
      }
    }

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
  } catch (err) {
    console.warn('Failed to fetch avatar, using cache:', err.message);
    return getCachedAvatar(userId);
  }
}

/**
 * Prune expired avatar cache entries (older than 30 days)
 * Should be called periodically (e.g., on app startup)
 */
export async function pruneExpiredAvatars() {
  try {
    const expiryThreshold = Date.now() - CACHE_EXPIRY_MS;
    await db.avatars.where('cachedAt').below(expiryThreshold).delete();
  } catch (err) {
    console.error('Error pruning expired avatars:', err);
  }
}
