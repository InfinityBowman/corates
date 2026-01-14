/**
 * Admin storage management routes
 * Handles R2 document listing, deletion, and statistics
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@/db/client.js';
import { mediaFiles } from '@/db/schema.js';
import {
  createDomainError,
  createValidationError,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';

const storageRoutes = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const field = firstIssue?.path?.[0] || 'input';
      const fieldName = String(field).charAt(0).toUpperCase() + String(field).slice(1);

      let message = firstIssue?.message || 'Validation failed';
      const isMissing =
        firstIssue?.received === 'undefined' ||
        message.includes('received undefined') ||
        message.includes('Required');

      if (isMissing) {
        message = `${fieldName} is required`;
      }

      const error = createValidationError(
        String(field),
        VALIDATION_ERRORS.FIELD_REQUIRED.code,
        null,
      );
      error.message = message;
      return c.json(error, 400);
    }
  },
});

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

// Response schemas
const StorageDocumentSchema = z
  .object({
    key: z.string(),
    fileName: z.string(),
    projectId: z.string(),
    studyId: z.string(),
    size: z.number(),
    uploaded: z.union([z.string(), z.date()]),
    etag: z.string(),
    orphaned: z.boolean(),
  })
  .openapi('StorageDocument');

const ListDocumentsResponseSchema = z
  .object({
    documents: z.array(StorageDocumentSchema),
    limit: z.number(),
    nextCursor: z.string().optional(),
    truncated: z.boolean().optional(),
  })
  .openapi('ListDocumentsResponse');

const DeleteDocumentsResponseSchema = z
  .object({
    deleted: z.number(),
    failed: z.number(),
    errors: z
      .array(
        z.object({
          key: z.string(),
          error: z.string(),
        }),
      )
      .optional(),
  })
  .openapi('DeleteDocumentsResponse');

const ProjectFileCountSchema = z
  .object({
    projectId: z.string(),
    count: z.number(),
  })
  .openapi('ProjectFileCount');

const StorageStatsResponseSchema = z
  .object({
    totalFiles: z.number(),
    totalSize: z.number(),
    filesByProject: z.array(ProjectFileCountSchema),
  })
  .openapi('StorageStatsResponse');

const StorageErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.unknown()).optional(),
  })
  .openapi('StorageError');

const R2_KEY_PATTERN = /^projects\/[^/]+\/studies\/[^/]+\/.+$/;

const DeleteDocumentsRequestSchema = z
  .object({
    keys: z
      .array(z.string().min(1).regex(R2_KEY_PATTERN, 'Invalid R2 key format'))
      .min(1, 'At least one key is required')
      .openapi({ description: 'Array of R2 keys to delete' }),
  })
  .openapi('DeleteDocumentsRequest');

// Route definitions
const listDocumentsRoute = createRoute({
  method: 'get',
  path: '/storage/documents',
  tags: ['Admin - Storage'],
  summary: 'List storage documents',
  description: 'List documents with cursor-based pagination. Admin only.',
  request: {
    query: z.object({
      cursor: z.string().optional().openapi({ description: 'Cursor token from previous response' }),
      limit: z
        .string()
        .optional()
        .refine(
          val => {
            if (!val) return true;
            const num = parseInt(val, 10);
            return !isNaN(num) && num >= 1 && num <= 1000;
          },
          { message: 'Limit must be between 1 and 1000' },
        )
        .openapi({ description: 'Results per page (default 50, max 1000)', example: '50' }),
      prefix: z
        .string()
        .optional()
        .openapi({ description: 'Filter by prefix (e.g., projects/{projectId}/)' }),
      search: z
        .string()
        .optional()
        .openapi({ description: 'Filter by file name (case-insensitive)' }),
    }),
  },
  responses: {
    200: {
      description: 'List of documents',
      content: {
        'application/json': {
          schema: ListDocumentsResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - not logged in',
      content: {
        'application/json': {
          schema: StorageErrorSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - not an admin',
      content: {
        'application/json': {
          schema: StorageErrorSchema,
        },
      },
    },
    500: {
      description: 'Internal error',
      content: {
        'application/json': {
          schema: StorageErrorSchema,
        },
      },
    },
  },
});

const deleteDocumentsRoute = createRoute({
  method: 'delete',
  path: '/storage/documents',
  tags: ['Admin - Storage'],
  summary: 'Bulk delete documents',
  description: 'Delete multiple documents by key. Admin only.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: DeleteDocumentsRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Deletion results',
      content: {
        'application/json': {
          schema: DeleteDocumentsResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: StorageErrorSchema,
        },
      },
    },
    500: {
      description: 'Internal error',
      content: {
        'application/json': {
          schema: StorageErrorSchema,
        },
      },
    },
  },
});

const getStorageStatsRoute = createRoute({
  method: 'get',
  path: '/storage/stats',
  tags: ['Admin - Storage'],
  summary: 'Get storage statistics',
  description: 'Get storage statistics including total files and size. Admin only.',
  responses: {
    200: {
      description: 'Storage statistics',
      content: {
        'application/json': {
          schema: StorageStatsResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - not logged in',
      content: {
        'application/json': {
          schema: StorageErrorSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - not an admin',
      content: {
        'application/json': {
          schema: StorageErrorSchema,
        },
      },
    },
    500: {
      description: 'Internal error',
      content: {
        'application/json': {
          schema: StorageErrorSchema,
        },
      },
    },
  },
});

/**
 * GET /api/admin/storage/documents
 * List documents with cursor-based pagination
 */
storageRoutes.openapi(listDocumentsRoute, async c => {
  try {
    const query = c.req.valid('query');
    const requestCursor = query.cursor?.trim() || undefined;
    const limit = Math.min(Math.max(parseInt(query.limit || '50', 10) || 50, 1), 1000);
    const prefix = query.prefix?.trim() || '';
    const search = query.search?.trim().toLowerCase() || '';

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
});

/**
 * DELETE /api/admin/storage/documents
 * Bulk delete documents
 */
storageRoutes.openapi(deleteDocumentsRoute, async c => {
  try {
    const { keys } = c.req.valid('json');

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
});

/**
 * GET /api/admin/storage/stats
 * Get storage statistics
 */
storageRoutes.openapi(getStorageStatsRoute, async c => {
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
