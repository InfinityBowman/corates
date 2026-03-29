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

import { db } from './db';

// LRU cache limits
const MAX_CACHE_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB total cache limit
const MAX_SINGLE_FILE_SIZE = 50 * 1024 * 1024; // 50 MB per file (matches PDF_LIMITS.MAX_SIZE)

/**
 * Generate cache key for a PDF
 */
function getCacheKey(projectId: string, studyId: string, fileName: string): string {
  return `${projectId}:${studyId}:${fileName}`;
}

/**
 * Get a PDF from the local cache
 */
export async function getCachedPdf(
  projectId: string,
  studyId: string,
  fileName: string,
): Promise<ArrayBuffer | null> {
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
 * Evict oldest entries until cache size is under the limit.
 * Uses a metadata-only query to avoid loading PDF binary data into memory.
 */
async function evictIfNeeded(requiredSpace: number): Promise<void> {
  try {
    const metadata: Array<{ id: string; size: number }> = [];
    let totalSize = 0;
    await db.pdfs.orderBy('cachedAt').each(entry => {
      metadata.push({ id: entry.id, size: entry.size || 0 });
      totalSize += entry.size || 0;
    });

    const targetSize = MAX_CACHE_SIZE_BYTES - requiredSpace;
    if (totalSize <= targetSize) {
      return;
    }

    const toDelete: string[] = [];
    for (const entry of metadata) {
      if (totalSize <= targetSize) break;
      toDelete.push(entry.id);
      totalSize -= entry.size;
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
 */
export async function cachePdf(
  projectId: string,
  studyId: string,
  fileName: string,
  data: ArrayBuffer,
): Promise<boolean> {
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
 */
export async function removeCachedPdf(
  projectId: string,
  studyId: string,
  fileName: string,
): Promise<boolean> {
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
 */
export async function clearStudyCache(projectId: string, studyId: string): Promise<number> {
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
 */
export async function clearProjectCache(projectId: string): Promise<number> {
  try {
    const count = await db.pdfs.where('projectId').equals(projectId).delete();
    return count;
  } catch (err) {
    console.warn('Failed to clear project cache:', err);
    return 0;
  }
}

/**
 * Get total cache size
 */
async function getTotalCacheSize(): Promise<number> {
  const all = await db.pdfs.toArray();
  return all.reduce((sum, entry) => sum + (entry.size || 0), 0);
}

/**
 * Get current cache size in bytes (for monitoring/debugging)
 */
export async function getCacheSize(): Promise<number> {
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
