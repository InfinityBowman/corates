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
// Half of the free space, so the sync engine's IndexedDB caches keep the other half.
const AVAILABLE_SPACE_FRACTION = 0.5;

/**
 * Generate cache key for a PDF
 */
function getCacheKey(projectId: string, studyId: string, fileName: string): string {
  return `${projectId}:${studyId}:${fileName}`;
}

/**
 * Record that a PDF was opened, for eviction ordering.
 *
 * Deliberately not awaited by callers: every read is on the path to rendering
 * a PDF, and a failed bookkeeping write must not turn a cache hit into a miss.
 */
function touchLastAccessed(id: string): void {
  db.pdfs.update(id, { lastAccessedAt: Date.now() }).catch(err => {
    console.warn('Failed to update PDF cache recency:', err);
  });
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
    if (!record) {
      return null;
    }

    touchLastAccessed(id);
    return record.data;
  } catch (err) {
    console.warn('Failed to read from PDF cache:', err);
    return null;
  }
}

/**
 * The cache limit for this device: the fixed ceiling, or less when the
 * browser's quota leaves little room. Entries already cached count as room,
 * since evicting them frees it.
 */
async function getCacheLimit(cachedBytes: number): Promise<number> {
  try {
    const { quota, usage } = (await navigator.storage?.estimate?.()) ?? {};
    if (quota === undefined || usage === undefined) return MAX_CACHE_SIZE_BYTES;
    const available = Math.max(0, quota - usage) + cachedBytes;
    return Math.min(MAX_CACHE_SIZE_BYTES, available * AVAILABLE_SPACE_FRACTION);
  } catch {
    return MAX_CACHE_SIZE_BYTES;
  }
}

/**
 * Entries in eviction order, least recently opened first.
 * Uses a metadata-only query to avoid loading PDF binary data into memory.
 */
async function getEvictionOrder(): Promise<{
  entries: Array<{ id: string; size: number }>;
  totalSize: number;
}> {
  const entries: Array<{ id: string; size: number }> = [];
  let totalSize = 0;
  await db.pdfs.orderBy('lastAccessedAt').each(entry => {
    entries.push({ id: entry.id, size: entry.size || 0 });
    totalSize += entry.size || 0;
  });
  return { entries, totalSize };
}

async function evictOldest(
  entries: Array<{ id: string; size: number }>,
  bytesToFree: number,
): Promise<void> {
  const toDelete: string[] = [];
  let freed = 0;
  for (const entry of entries) {
    if (freed >= bytesToFree) break;
    toDelete.push(entry.id);
    freed += entry.size;
  }

  if (toDelete.length > 0) {
    await db.pdfs.bulkDelete(toDelete);
  }
}

/**
 * Evict least recently opened entries until `requiredSpace` fits under the limit.
 * Returns false when the file would not fit even in an empty cache.
 */
async function evictIfNeeded(requiredSpace: number): Promise<boolean> {
  try {
    const { entries, totalSize } = await getEvictionOrder();
    const limit = await getCacheLimit(totalSize);
    if (requiredSpace > limit) return false;
    await evictOldest(entries, totalSize + requiredSpace - limit);
  } catch (err) {
    console.warn('Failed to evict from PDF cache:', err);
  }
  return true;
}

function isQuotaError(err: unknown): boolean {
  const e = err as { name?: string; inner?: { name?: string } } | null;
  return e?.name === 'QuotaExceededError' || e?.inner?.name === 'QuotaExceededError';
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

    if (!(await evictIfNeeded(fileSize))) {
      return false;
    }

    const now = Date.now();
    const record = {
      id: getCacheKey(projectId, studyId, fileName),
      projectId,
      studyId,
      fileName,
      data,
      size: fileSize,
      cachedAt: now,
      lastAccessedAt: now,
    };
    try {
      await db.pdfs.put(record);
    } catch (err) {
      if (!isQuotaError(err)) throw err;
      // The estimate can lag real usage, so free this file's size and try once more.
      await evictOldest((await getEvictionOrder()).entries, fileSize);
      await db.pdfs.put(record);
    }

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
