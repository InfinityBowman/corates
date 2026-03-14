/**
 * pdfCache - Local-first PDF caching layer using Dexie
 *
 * This provides a cache for PDFs stored in cloud (R2) to enable:
 * - Fast loading from local cache
 * - Offline access to previously viewed PDFs
 * - Reduced bandwidth usage
 *
 * The cloud (R2) remains the source of truth. This is just a cache.
 */

import { db } from './db.js';

// LRU cache limits
const MAX_CACHE_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB total cache limit
const MAX_SINGLE_FILE_SIZE = 50 * 1024 * 1024; // 50 MB per file (matches PDF_LIMITS.MAX_SIZE)

/**
 * Generate cache key for a PDF
 * @param {string} projectId
 * @param {string} studyId
 * @param {string} fileName
 * @returns {string}
 */
function getCacheKey(projectId, studyId, fileName) {
  return `${projectId}:${studyId}:${fileName}`;
}

/**
 * Get a PDF from the local cache
 * @param {string} projectId
 * @param {string} studyId
 * @param {string} fileName
 * @returns {Promise<ArrayBuffer|null>} The PDF data or null if not cached
 */
export async function getCachedPdf(projectId, studyId, fileName) {
  try {
    const id = getCacheKey(projectId, studyId, fileName);
    const record = await db.pdfs.get(id);
    return record?.data ?? null;
  } catch (err) {
    console.warn('Failed to read from PDF cache:', err);
    return null;
  }
}

/**
 * Get total cache size
 * @returns {Promise<number>}
 */
async function getTotalCacheSize() {
  const all = await db.pdfs.toArray();
  return all.reduce((sum, entry) => sum + (entry.size || 0), 0);
}

/**
 * Evict oldest entries until cache size is under the limit
 * @param {number} requiredSpace - Additional space needed for new entry
 */
async function evictIfNeeded(requiredSpace) {
  try {
    const all = await db.pdfs.orderBy('cachedAt').toArray();
    let totalSize = all.reduce((sum, entry) => sum + (entry.size || 0), 0);
    const targetSize = MAX_CACHE_SIZE_BYTES - requiredSpace;

    if (totalSize <= targetSize) {
      return;
    }

    const toDelete = [];
    for (const entry of all) {
      if (totalSize <= targetSize) break;
      toDelete.push(entry.id);
      totalSize -= entry.size || 0;
    }

    if (toDelete.length > 0) {
      await db.pdfs.bulkDelete(toDelete);
    }
  } catch (err) {
    console.warn('Failed to evict from PDF cache:', err);
  }
}

/**
 * Save a PDF to the local cache with LRU eviction
 * @param {string} projectId
 * @param {string} studyId
 * @param {string} fileName
 * @param {ArrayBuffer} data
 * @returns {Promise<boolean>}
 */
export async function cachePdf(projectId, studyId, fileName, data) {
  try {
    const fileSize = data.byteLength;

    if (fileSize > MAX_SINGLE_FILE_SIZE) {
      console.warn(`PDF too large to cache: ${fileSize} bytes (limit: ${MAX_SINGLE_FILE_SIZE})`);
      return false;
    }

    await evictIfNeeded(fileSize);

    await db.pdfs.put({
      id: getCacheKey(projectId, studyId, fileName),
      projectId,
      studyId,
      fileName,
      data,
      size: fileSize,
      cachedAt: Date.now(),
    });

    return true;
  } catch (err) {
    console.warn('Failed to write to PDF cache:', err);
    return false;
  }
}

/**
 * Remove a PDF from the local cache
 * @param {string} projectId
 * @param {string} studyId
 * @param {string} fileName
 * @returns {Promise<boolean>}
 */
export async function removeCachedPdf(projectId, studyId, fileName) {
  try {
    const id = getCacheKey(projectId, studyId, fileName);
    await db.pdfs.delete(id);
    return true;
  } catch (err) {
    console.warn('Failed to remove from PDF cache:', err);
    return false;
  }
}

/**
 * Clear all cached PDFs for a study
 * @param {string} projectId
 * @param {string} studyId
 * @returns {Promise<number>} Number of entries deleted
 */
export async function clearStudyCache(projectId, studyId) {
  try {
    const keyPrefix = `${projectId}:${studyId}:`;
    const toDelete = await db.pdfs.filter(entry => entry.id.startsWith(keyPrefix)).primaryKeys();
    await db.pdfs.bulkDelete(toDelete);
    return toDelete.length;
  } catch (err) {
    console.warn('Failed to clear study cache:', err);
    return 0;
  }
}

/**
 * Clear all cached PDFs for a project
 * @param {string} projectId
 * @returns {Promise<number>} Number of entries deleted
 */
export async function clearProjectCache(projectId) {
  try {
    const count = await db.pdfs.where('projectId').equals(projectId).delete();
    return count;
  } catch (err) {
    console.warn('Failed to clear project cache:', err);
    return 0;
  }
}

/**
 * Get current cache size in bytes (for monitoring/debugging)
 * @returns {Promise<number>}
 */
export async function getCacheSize() {
  try {
    return await getTotalCacheSize();
  } catch (err) {
    console.warn('Failed to get cache size:', err);
    return 0;
  }
}

export default {
  getCachedPdf,
  cachePdf,
  removeCachedPdf,
  clearStudyCache,
  clearProjectCache,
  getCacheSize,
};
