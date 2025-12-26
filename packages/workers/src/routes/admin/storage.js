/**
 * Admin storage management routes
 * Handles R2 document listing, deletion, and statistics
 */

import { Hono } from 'hono';
import { createDb } from '../../db/client.js';
import { projects } from '../../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  VALIDATION_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';

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
 * Validate R2 key matches expected pattern
 */
function isValidKey(key) {
  return /^projects\/[^/]+\/studies\/[^/]+\/.+$/.test(key);
}

/**
 * GET /api/admin/storage/documents
 * List all documents with pagination
 * Query params:
 *   - page: page number (default 1)
 *   - limit: results per page (default 50, max 1000)
 *   - prefix: filter by prefix (e.g., "projects/{projectId}/")
 *   - search: filter by file name (case-insensitive substring match)
 */
storageRoutes.get('/storage/documents', async c => {
  try {
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const limit = Math.min(1000, Math.max(1, parseInt(c.req.query('limit') || '50', 10)));
    const prefix = c.req.query('prefix')?.trim() || '';
    const search = c.req.query('search')?.trim()?.toLowerCase() || '';

    // R2 doesn't support offset, so we need to fetch and filter all matching items
    // For large datasets, this could be expensive, but it's necessary for accurate results
    let cursor = undefined;
    let allObjects = [];
    let hasMore = false;

    // Fetch all matching objects (with prefix/search filtering)
    do {
      const listOptions = {
        limit: 1000,
        prefix: prefix || undefined,
      };
      if (cursor) {
        listOptions.cursor = cursor;
      }

      const listed = await c.env.PDF_BUCKET.list(listOptions);

      if (listed.objects.length === 0) {
        break;
      }

      // Parse metadata for each object and apply filters
      const parsedObjects = listed.objects
        .map(obj => {
          const parsed = parseKey(obj.key);
          if (!parsed) {
            return null;
          }

          // Apply search filter if provided
          if (search && !parsed.fileName.toLowerCase().includes(search)) {
            return null;
          }

          return {
            key: obj.key,
            fileName: parsed.fileName,
            projectId: parsed.projectId,
            studyId: parsed.studyId,
            size: obj.size,
            uploaded: obj.uploaded,
            etag: obj.etag,
          };
        })
        .filter(Boolean);

      allObjects.push(...parsedObjects);

      hasMore = listed.truncated;
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    // Apply pagination to filtered results
    const total = allObjects.length;
    const skip = (page - 1) * limit;
    const paginatedObjects = allObjects.slice(skip, skip + limit);

    // Check which projects exist in the database to identify orphaned PDFs
    const uniqueProjectIds = [...new Set(paginatedObjects.map(doc => doc.projectId))];
    const db = createDb(c.env.DB);
    const existingProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(inArray(projects.id, uniqueProjectIds));

    const existingProjectIds = new Set(existingProjects.map(p => p.id));

    // Mark documents as orphaned if their project doesn't exist
    const documentsWithOrphanStatus = paginatedObjects.map(doc => ({
      ...doc,
      orphaned: !existingProjectIds.has(doc.projectId),
    }));

    return c.json({
      documents: documentsWithOrphanStatus,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + paginatedObjects.length < total,
      },
    });
  } catch (error) {
    console.error('Error listing storage documents:', error);
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'list_storage_documents',
      originalError: error.message,
    });
    return c.json(systemError, systemError.statusCode);
  }
});

/**
 * DELETE /api/admin/storage/documents
 * Bulk delete documents
 * Body: { keys: string[] }
 */
storageRoutes.delete('/storage/documents', async c => {
  try {
    const body = await c.req.json();
    const { keys } = body;

    if (!Array.isArray(keys) || keys.length === 0) {
      const error = createValidationError(
        'keys',
        VALIDATION_ERRORS.FIELD_REQUIRED.code,
        keys,
        'keys_array_required',
      );
      return c.json(error, error.statusCode);
    }

    // Validate all keys match expected pattern
    const invalidKeys = keys.filter(key => !isValidKey(key));
    if (invalidKeys.length > 0) {
      const error = createValidationError(
        'keys',
        VALIDATION_ERRORS.FIELD_INVALID_FORMAT.code,
        invalidKeys,
        'invalid_key_format',
      );
      return c.json(error, error.statusCode);
    }

    // Delete all keys in parallel
    const deleteResults = await Promise.allSettled(keys.map(key => c.env.PDF_BUCKET.delete(key)));

    const deleted = deleteResults.filter(r => r.status === 'fulfilled').length;
    const failed = deleteResults.filter(r => r.status === 'rejected').length;
    const errors =
      failed > 0 ?
        deleteResults
          .filter(r => r.status === 'rejected')
          .map((r, i) => ({
            key: keys[i],
            error: r.reason?.message || 'Unknown error',
          }))
      : undefined;

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
});

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
