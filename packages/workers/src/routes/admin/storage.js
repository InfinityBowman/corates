/**
 * Admin storage management routes
 * Handles R2 document listing, deletion, and statistics
 */

import { Hono } from 'hono';
import { createDb } from '../../db/client.js';
import { mediaFiles } from '../../db/schema.js';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { storageSchemas, validateQueryParams, validateRequest } from '../../config/validation.js';

const storageRoutes = new Hono();

/**
 * Parse project/study IDs from R2 key pattern: projects/{projectId}/studies/{studyId}/{fileName}
 */
function parseKey(key) {
  const match = key.match(/^projects\/([^/]+)\/studies\/([^/]+)\/(.+)$/);
  if (!match) {
    return null;
  }
  return {
    projectId: match[1],
    studyId: match[2],
    fileName: match[3],
  };
}

/**
 * GET /api/admin/storage/documents
 * List documents with cursor-based pagination
 * Query params:
 *   - cursor: optional cursor token from previous response to continue pagination
 *   - limit: results per page (default 50, max 1000)
 *   - prefix: filter by prefix (e.g., "projects/{projectId}/")
 *   - search: filter by file name (case-insensitive substring match)
 *
 * Returns:
 *   - documents: array of matching documents
 *   - nextCursor: cursor token for next page (if more results available)
 *   - truncated: true if processing was stopped due to cap (10k objects processed)
 */
storageRoutes.get(
  '/storage/documents',
  validateQueryParams(storageSchemas.listDocuments),
  async c => {
    try {
      const { cursor: requestCursor, limit, prefix, search } = c.get('validatedQuery');

      // Decode composite cursor: {r2Cursor: string | undefined, skipCount: number}
      let r2Cursor = undefined;
      let skipCount = 0;
      if (requestCursor) {
        try {
          const decoded = JSON.parse(requestCursor);
          r2Cursor = decoded.r2Cursor;
          skipCount = Math.max(0, decoded.skipCount || 0);
          // If r2Cursor is undefined, we're starting from beginning of R2, so reset skipCount
          if (!r2Cursor) {
            skipCount = 0;
          }
        } catch {
          // Invalid cursor format, treat as first request
          r2Cursor = requestCursor;
          skipCount = 0;
        }
      }

      const PROCESSING_CAP = 10000;
      const matchingObjects = [];
      let currentCursor = r2Cursor;
      let objectsProcessed = 0;
      let truncated = false;
      let listedTruncated = false;

      // Process batches until we have enough matching results (skipCount + limit) or hit the cap
      while (matchingObjects.length < skipCount + limit && objectsProcessed < PROCESSING_CAP) {
        const listOptions = {
          limit: 1000,
          prefix: prefix || undefined,
        };
        if (currentCursor) {
          listOptions.cursor = currentCursor;
        }

        const listed = await c.env.PDF_BUCKET.list(listOptions);

        if (listed.objects.length === 0) {
          listedTruncated = false;
          break;
        }

        objectsProcessed += listed.objects.length;

        // Process the entire batch to avoid skipping objects when we hit the limit
        for (const obj of listed.objects) {
          const parsed = parseKey(obj.key);
          if (!parsed) {
            continue;
          }

          // Apply search filter if provided
          if (search && !parsed.fileName.toLowerCase().includes(search)) {
            continue;
          }

          matchingObjects.push({
            key: obj.key,
            fileName: parsed.fileName,
            projectId: parsed.projectId,
            studyId: parsed.studyId,
            size: obj.size,
            uploaded: obj.uploaded,
            etag: obj.etag,
          });
        }

        // Update cursor for next batch
        if (listed.truncated) {
          currentCursor = listed.cursor;
          listedTruncated = true;
        } else {
          listedTruncated = false;
          break;
        }

        // Stop if we hit the processing cap
        if (objectsProcessed >= PROCESSING_CAP) {
          truncated = true;
          break;
        }
      }

      // Guard against skipCount exceeding matchingObjects.length
      skipCount = Math.min(skipCount, matchingObjects.length);

      // Slice with offset to get the correct page
      const paginatedObjects = matchingObjects.slice(skipCount, skipCount + limit);

      // Check which PDFs are tracked in mediaFiles table to identify orphaned PDFs
      // Orphans are R2 objects whose keys are NOT in mediaFiles.bucketKey
      const db = createDb(c.env.DB);
      const trackedKeys = await db.select({ bucketKey: mediaFiles.bucketKey }).from(mediaFiles);

      const trackedKeysSet = new Set(trackedKeys.map(row => row.bucketKey));

      // Mark documents as orphaned if their key is not in mediaFiles table
      const documentsWithOrphanStatus = paginatedObjects.map(doc => ({
        ...doc,
        orphaned: !trackedKeysSet.has(doc.key),
      }));

      const response = {
        documents: documentsWithOrphanStatus,
        limit,
      };

      // Determine if there are more results available
      // Return nextCursor only if:
      // 1. There are more R2 objects to process (listedTruncated && currentCursor), OR
      // 2. We hit the processing cap AND have a cursor to continue from
      // Note: If R2 is exhausted (listedTruncated = false), we can't persist cached matches
      // across requests, so we don't return a nextCursor even if we have cached matches
      const hasMoreR2Objects = listedTruncated && currentCursor;
      const canContinueAfterCap = truncated && currentCursor;

      // Include nextCursor if there are more results available and we have a cursor to continue from
      if (hasMoreR2Objects || canContinueAfterCap) {
        const nextSkipCount = Math.max(0, skipCount + paginatedObjects.length);
        const nextCursorData = {
          r2Cursor: currentCursor,
          skipCount: nextSkipCount,
        };
        response.nextCursor = JSON.stringify(nextCursorData);
      }

      // Include truncated flag if we hit the processing cap
      if (truncated) {
        response.truncated = true;
      }

      return c.json(response);
    } catch (error) {
      console.error('Error listing storage documents:', error);
      const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'list_storage_documents',
        originalError: error.message,
      });
      return c.json(systemError, systemError.statusCode);
    }
  },
);

/**
 * DELETE /api/admin/storage/documents
 * Bulk delete documents
 * Body: { keys: string[] }
 */
storageRoutes.delete(
  '/storage/documents',
  validateRequest(storageSchemas.deleteDocuments),
  async c => {
    try {
      const { keys } = c.get('validatedBody');

      // Delete all keys in parallel
      const deleteResults = await Promise.allSettled(keys.map(key => c.env.PDF_BUCKET.delete(key)));

      const deleted = deleteResults.filter(r => r.status === 'fulfilled').length;
      const failed = deleteResults.filter(r => r.status === 'rejected').length;

      let errors;
      if (failed > 0) {
        errors = [];
        deleteResults.forEach((result, i) => {
          if (result.status === 'rejected') {
            errors.push({
              key: keys[i],
              error: result.reason?.message || 'Unknown error',
            });
          }
        });
      }

      return c.json({
        deleted,
        failed,
        errors,
      });
    } catch (error) {
      console.error('Error deleting storage documents:', error);
      const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'delete_storage_documents',
        originalError: error.message,
      });
      return c.json(systemError, systemError.statusCode);
    }
  },
);

/**
 * GET /api/admin/storage/stats
 * Get storage statistics
 */
storageRoutes.get('/storage/stats', async c => {
  try {
    let cursor = undefined;
    let totalFiles = 0;
    let totalSize = 0;
    const filesByProject = {};

    // Iterate through all objects to calculate stats
    do {
      const listed = await c.env.PDF_BUCKET.list({
        limit: 1000,
        cursor,
      });

      for (const obj of listed.objects) {
        totalFiles++;
        totalSize += obj.size;

        const parsed = parseKey(obj.key);
        if (parsed) {
          filesByProject[parsed.projectId] = (filesByProject[parsed.projectId] || 0) + 1;
        }
      }

      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    return c.json({
      totalFiles,
      totalSize,
      filesByProject: Object.entries(filesByProject).map(([projectId, count]) => ({
        projectId,
        count,
      })),
    });
  } catch (error) {
    console.error('Error fetching storage stats:', error);
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'fetch_storage_stats',
      originalError: error.message,
    });
    return c.json(systemError, systemError.statusCode);
  }
});

export { storageRoutes };
