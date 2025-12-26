/**
 * Admin storage management routes
 * Handles R2 document listing, deletion, and statistics
 */

import { Hono } from 'hono';
import { createDb } from '../../db/client.js';
import { projects } from '../../db/schema.js';
import { inArray } from 'drizzle-orm';
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

      const PROCESSING_CAP = 10000;
      const matchingObjects = [];
      let currentCursor = requestCursor;
      let objectsProcessed = 0;
      let hasMore = false;
      let truncated = false;

      // Process batches until we have enough matching results or hit the cap
      while (matchingObjects.length < limit && objectsProcessed < PROCESSING_CAP) {
        const listOptions = {
          limit: 1000,
          prefix: prefix || undefined,
        };
        if (currentCursor) {
          listOptions.cursor = currentCursor;
        }

        const listed = await c.env.PDF_BUCKET.list(listOptions);

        if (listed.objects.length === 0) {
          break;
        }

        objectsProcessed += listed.objects.length;

        // Process the entire batch to avoid skipping objects when we hit the limit
        // We'll collect all matching objects in this batch, then slice to limit later
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

        // After processing the entire batch, check if we have enough results
        if (matchingObjects.length >= limit) {
          // We've collected enough matches. Set cursor for next batch if available
          if (listed.truncated) {
            currentCursor = listed.cursor;
            hasMore = true;
          } else {
            hasMore = false;
          }
          break;
        }

        // Check if there are more objects available from R2
        if (listed.truncated) {
          currentCursor = listed.cursor;
          hasMore = true;
        } else {
          hasMore = false;
          break;
        }

        // Stop if we hit the processing cap
        if (objectsProcessed >= PROCESSING_CAP) {
          truncated = true;
          break;
        }
      }

      // Limit results to requested limit
      const paginatedObjects = matchingObjects.slice(0, limit);

      // Check which projects exist in the database to identify orphaned PDFs
      const uniqueProjectIds = [...new Set(paginatedObjects.map(doc => doc.projectId))];
      let existingProjectIds = new Set();

      // Only query database if there are project IDs to check
      // inArray with empty array generates invalid SQL (WHERE id IN ())
      if (uniqueProjectIds.length > 0) {
        const db = createDb(c.env.DB);
        const existingProjects = await db
          .select({ id: projects.id })
          .from(projects)
          .where(inArray(projects.id, uniqueProjectIds));

        existingProjectIds = new Set(existingProjects.map(p => p.id));
      }

      // Mark documents as orphaned if their project doesn't exist
      const documentsWithOrphanStatus = paginatedObjects.map(doc => ({
        ...doc,
        orphaned: !existingProjectIds.has(doc.projectId),
      }));

      const response = {
        documents: documentsWithOrphanStatus,
        limit,
      };

      // Include nextCursor if there are more results available
      if (hasMore && currentCursor) {
        response.nextCursor = currentCursor;
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
