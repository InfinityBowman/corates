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

import { API_BASE } from '@/config/api';
import { compressImageBlob } from '@/lib/imageUtils.js';
import { db } from './db';

// Cache expiry: 30 days in milliseconds
const CACHE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

// Maximum avatar size before compression (500KB)
const MAX_AVATAR_SIZE = 500 * 1024;

/**
 * Convert a blob to a base64 data URL
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Get a cached avatar for a user
 */
export async function getCachedAvatar(userId: string): Promise<string | null> {
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
 */
export async function cacheAvatar(userId: string, dataUrl: string): Promise<void> {
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
 */
export async function removeCachedAvatar(userId: string): Promise<void> {
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
 */
export async function fetchAndCacheAvatar(
  userId: string,
  imageUrl: string,
): Promise<string | null> {
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
 * Prune expired avatar cache entries (older than 30 days)
 * Should be called periodically (e.g., on app startup)
 */
export async function pruneExpiredAvatars(): Promise<void> {
  try {
    const expiryThreshold = Date.now() - CACHE_EXPIRY_MS;
    await db.avatars.where('cachedAt').below(expiryThreshold).delete();
  } catch (err) {
    console.error('Error pruning expired avatars:', err);
  }
}
