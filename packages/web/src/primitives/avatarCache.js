/**
 * avatarCache - Local caching layer for user avatars
 *
 * This provides offline access to avatar images by storing them in Dexie.
 * When online, avatars are fetched from the API and cached locally.
 * When offline, the cached version is used.
 */

import { API_BASE } from '@config/api.js';
import { compressImageBlob } from '@lib/imageUtils.js';
import { db } from './db.js';

// Cache expiry: 30 days in milliseconds
const CACHE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

// Maximum avatar size before compression (500KB)
const MAX_AVATAR_SIZE = 500 * 1024;

// Rate limiting for external avatar fetches (e.g., Google avatars)
// Track failed fetches to avoid hammering external servers
const externalFetchFailures = new Map(); // url -> { failedAt, retryAfter }
const EXTERNAL_RETRY_DELAY_MS = 60 * 1000; // Wait 1 minute before retrying failed external fetches
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000; // Max 5 minutes between retries

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
 * Check if we should skip fetching an external URL due to recent failures
 * @param {string} url - The URL to check
 * @returns {boolean} - True if we should skip this fetch
 */
function shouldSkipExternalFetch(url) {
  const failure = externalFetchFailures.get(url);
  if (!failure) return false;

  const elapsed = Date.now() - failure.failedAt;
  if (elapsed >= failure.retryAfter) {
    // Enough time has passed, allow retry
    return false;
  }
  return true;
}

/**
 * Record a failed external fetch for rate limiting
 * @param {string} url - The URL that failed
 * @param {number} [retryAfterHeader] - Retry-After header value in seconds (if provided)
 */
function recordExternalFetchFailure(url, retryAfterHeader) {
  const existing = externalFetchFailures.get(url);
  // Exponential backoff: double the delay each time, up to max
  const baseDelay = existing?.retryAfter || EXTERNAL_RETRY_DELAY_MS;
  const newDelay = Math.min(baseDelay * 2, MAX_RETRY_DELAY_MS);

  // If server provided Retry-After header, use that instead
  const retryAfter = retryAfterHeader ? retryAfterHeader * 1000 : newDelay;

  externalFetchFailures.set(url, {
    failedAt: Date.now(),
    retryAfter,
  });
}

/**
 * Clear failure record for a URL (on successful fetch)
 * @param {string} url - The URL to clear
 */
function clearExternalFetchFailure(url) {
  externalFetchFailures.delete(url);
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

    // For external URLs, check if we should skip due to rate limiting
    if (!isRelativeUrl && shouldSkipExternalFetch(fullUrl)) {
      // Return cached version if available, otherwise null
      return getCachedAvatar(userId);
    }

    // Only include credentials for our API (relative URLs), not for external URLs (e.g., Google avatars)
    // External URLs like lh3.googleusercontent.com don't allow credentials with CORS
    const fetchOptions = isRelativeUrl ? { credentials: 'include' } : {};

    const response = await fetch(fullUrl, fetchOptions);

    if (!response.ok) {
      // Handle rate limiting (429) and other errors for external URLs
      if (!isRelativeUrl) {
        const retryAfter = response.headers.get('Retry-After');
        recordExternalFetchFailure(fullUrl, retryAfter ? parseInt(retryAfter, 10) : null);
      }
      // Only warn for non-429 errors or first 429 occurrence
      if (response.status !== 429) {
        console.warn('Failed to fetch avatar:', response.status);
      }
      return null;
    }

    // Clear any failure record on success
    if (!isRelativeUrl) {
      clearExternalFetchFailure(fullUrl);
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
