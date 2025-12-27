/**
 * avatarCache - Local caching layer for user avatars
 *
 * This provides offline access to avatar images by storing them in IndexedDB.
 * When online, avatars are fetched from the API and cached locally.
 * When offline, the cached version is used.
 */

import { API_BASE } from '@config/api.js'
import { compressImageBlob } from '@lib/imageUtils.js'

const DB_NAME = 'corates-avatar-cache'
const DB_VERSION = 1
const AVATAR_STORE_NAME = 'avatars'

// Cache expiry: 30 days in milliseconds
const CACHE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000

// Maximum avatar size before compression (500KB)
const MAX_AVATAR_SIZE = 500 * 1024

// Rate limiting for external avatar fetches (e.g., Google avatars)
// Track failed fetches to avoid hammering external servers
const externalFetchFailures = new Map() // url -> { failedAt, retryAfter }
const EXTERNAL_RETRY_DELAY_MS = 60 * 1000 // Wait 1 minute before retrying failed external fetches
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000 // Max 5 minutes between retries

// Shared database instance and initialization promise
let dbInstance = null
let dbInitPromise = null

/**
 * Open the IndexedDB database (singleton pattern)
 */
function openDatabase() {
  if (dbInitPromise) return dbInitPromise

  dbInitPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(AVATAR_STORE_NAME)) {
        const store = db.createObjectStore(AVATAR_STORE_NAME, {
          keyPath: 'userId',
        })
        store.createIndex('cachedAt', 'cachedAt', { unique: false })
      }
    }
  })

  return dbInitPromise
}

/**
 * Get database instance
 */
async function getDb() {
  if (dbInstance) return dbInstance
  return openDatabase()
}

/**
 * Convert a blob to a base64 data URL
 */
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Get a cached avatar for a user
 * @param {string} userId - The user ID
 * @returns {Promise<string|null>} - Data URL of the avatar or null if not cached
 */
export async function getCachedAvatar(userId) {
  if (!userId) return null

  try {
    const db = await getDb()
    const tx = db.transaction(AVATAR_STORE_NAME, 'readonly')
    const store = tx.objectStore(AVATAR_STORE_NAME)

    return new Promise((resolve, reject) => {
      const request = store.get(userId)
      request.onsuccess = () => {
        const result = request.result
        if (result?.dataUrl) {
          resolve(result.dataUrl)
        } else {
          resolve(null)
        }
      }
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.error('Error getting cached avatar:', err)
    return null
  }
}

/**
 * Cache an avatar for a user
 * @param {string} userId - The user ID
 * @param {string} dataUrl - The data URL of the avatar image
 */
export async function cacheAvatar(userId, dataUrl) {
  if (!userId || !dataUrl) return

  try {
    const db = await getDb()
    const tx = db.transaction(AVATAR_STORE_NAME, 'readwrite')
    const store = tx.objectStore(AVATAR_STORE_NAME)

    await new Promise((resolve, reject) => {
      const request = store.put({
        userId,
        dataUrl,
        cachedAt: Date.now(),
      })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.error('Error caching avatar:', err)
  }
}

/**
 * Remove a cached avatar
 * @param {string} userId - The user ID
 */
export async function removeCachedAvatar(userId) {
  if (!userId) return

  try {
    const db = await getDb()
    const tx = db.transaction(AVATAR_STORE_NAME, 'readwrite')
    const store = tx.objectStore(AVATAR_STORE_NAME)

    await new Promise((resolve, reject) => {
      const request = store.delete(userId)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.error('Error removing cached avatar:', err)
  }
}

/**
 * Check if we should skip fetching an external URL due to recent failures
 * @param {string} url - The URL to check
 * @returns {boolean} - True if we should skip this fetch
 */
function shouldSkipExternalFetch(url) {
  const failure = externalFetchFailures.get(url)
  if (!failure) return false

  const elapsed = Date.now() - failure.failedAt
  if (elapsed >= failure.retryAfter) {
    // Enough time has passed, allow retry
    return false
  }
  return true
}

/**
 * Record a failed external fetch for rate limiting
 * @param {string} url - The URL that failed
 * @param {number} [retryAfterHeader] - Retry-After header value in seconds (if provided)
 */
function recordExternalFetchFailure(url, retryAfterHeader) {
  const existing = externalFetchFailures.get(url)
  // Exponential backoff: double the delay each time, up to max
  const baseDelay = existing?.retryAfter || EXTERNAL_RETRY_DELAY_MS
  const newDelay = Math.min(baseDelay * 2, MAX_RETRY_DELAY_MS)

  // If server provided Retry-After header, use that instead
  const retryAfter = retryAfterHeader ? retryAfterHeader * 1000 : newDelay

  externalFetchFailures.set(url, {
    failedAt: Date.now(),
    retryAfter,
  })
}

/**
 * Clear failure record for a URL (on successful fetch)
 * @param {string} url - The URL to clear
 */
function clearExternalFetchFailure(url) {
  externalFetchFailures.delete(url)
}

/**
 * Fetch an avatar from the API and cache it
 * @param {string} userId - The user ID
 * @param {string} imageUrl - The avatar URL (can be relative or absolute)
 * @returns {Promise<string|null>} - Data URL of the avatar or null if failed
 */
export async function fetchAndCacheAvatar(userId, imageUrl) {
  if (!userId || !imageUrl) return null

  try {
    // Build the full URL - handle both relative and absolute URLs
    let fullUrl = imageUrl
    const isRelativeUrl = imageUrl.startsWith('/')
    if (isRelativeUrl) {
      fullUrl = `${API_BASE}${imageUrl}`
    }

    // For external URLs, check if we should skip due to rate limiting
    if (!isRelativeUrl && shouldSkipExternalFetch(fullUrl)) {
      // Return cached version if available, otherwise null
      return getCachedAvatar(userId)
    }

    // Only include credentials for our API (relative URLs), not for external URLs (e.g., Google avatars)
    // External URLs like lh3.googleusercontent.com don't allow credentials with CORS
    const fetchOptions = isRelativeUrl ? { credentials: 'include' } : {}

    const response = await fetch(fullUrl, fetchOptions)

    if (!response.ok) {
      // Handle rate limiting (429) and other errors for external URLs
      if (!isRelativeUrl) {
        const retryAfter = response.headers.get('Retry-After')
        recordExternalFetchFailure(
          fullUrl,
          retryAfter ? parseInt(retryAfter, 10) : null,
        )
      }
      // Only warn for non-429 errors or first 429 occurrence
      if (response.status !== 429) {
        console.warn('Failed to fetch avatar:', response.status)
      }
      return null
    }

    // Clear any failure record on success
    if (!isRelativeUrl) {
      clearExternalFetchFailure(fullUrl)
    }

    let blob = await response.blob()

    // Compress large avatars before caching
    if (blob.size > MAX_AVATAR_SIZE) {
      try {
        blob = await compressImageBlob(blob, { maxSize: 256, quality: 0.85 })
      } catch (err) {
        console.warn('Failed to compress avatar, caching original:', err)
      }
    }

    const dataUrl = await blobToDataUrl(blob)

    // Cache the avatar
    await cacheAvatar(userId, dataUrl)

    return dataUrl
  } catch (err) {
    console.error('Error fetching avatar:', err)
    return null
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
  if (!userId) return null

  // If no image URL, just check cache (for offline scenarios)
  if (!imageUrl) {
    return getCachedAvatar(userId)
  }

  // If offline, return cached version
  if (!navigator.onLine) {
    return getCachedAvatar(userId)
  }

  // Online: fetch and cache, falling back to cache on error
  try {
    const dataUrl = await fetchAndCacheAvatar(userId, imageUrl)
    return dataUrl
  } catch {
    // If fetch fails, try to return cached version
    return getCachedAvatar(userId)
  }
}

/**
 * Clear all cached avatars (e.g., on logout)
 */
export async function clearAvatarCache() {
  try {
    const db = await getDb()
    const tx = db.transaction(AVATAR_STORE_NAME, 'readwrite')
    const store = tx.objectStore(AVATAR_STORE_NAME)

    await new Promise((resolve, reject) => {
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.error('Error clearing avatar cache:', err)
  }
}

/**
 * Prune expired avatar cache entries (older than 30 days)
 * Should be called periodically (e.g., on app startup)
 */
export async function pruneExpiredAvatars() {
  try {
    const db = await getDb()
    const tx = db.transaction(AVATAR_STORE_NAME, 'readwrite')
    const store = tx.objectStore(AVATAR_STORE_NAME)
    const index = store.index('cachedAt')

    const expiryThreshold = Date.now() - CACHE_EXPIRY_MS

    // Get all entries older than the threshold using the cachedAt index
    // eslint-disable-next-line no-undef
    const range = IDBKeyRange.upperBound(expiryThreshold)

    await new Promise((resolve, reject) => {
      const request = index.openCursor(range)
      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.error('Error pruning expired avatars:', err)
  }
}
