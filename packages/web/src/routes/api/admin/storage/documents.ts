/**
 * Admin storage documents
 *
 * GET /api/admin/storage/documents — cursor-paginated R2 listing with optional
 * prefix/search filters and orphan flag (key not present in mediaFiles).
 * DELETE /api/admin/storage/documents — bulk delete by R2 key.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { mediaFiles } from '@corates/db/schema';
import {
  createDomainError,
  createValidationError,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { adminMiddleware } from '@/server/middleware/admin';

const R2_KEY_PATTERN = /^projects\/[^/]+\/studies\/[^/]+\/.+$/;

interface ParsedKey {
  projectId: string;
  studyId: string;
  fileName: string;
}

function parseKey(key: string): ParsedKey | null {
  const match = key.match(/^projects\/([^/]+)\/studies\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { projectId: match[1], studyId: match[2], fileName: match[3] };
}

interface StorageDoc {
  key: string;
  fileName: string;
  projectId: string;
  studyId: string;
  size: number;
  uploaded: Date;
  etag: string;
}

export const handleGet = async ({ request }: { request: Request }) => {
  try {
    const url = new URL(request.url);
    const requestCursor = url.searchParams.get('cursor')?.trim() || undefined;
    const limitParam = url.searchParams.get('limit');
    if (limitParam !== null && limitParam !== '') {
      const num = parseInt(limitParam, 10);
      if (isNaN(num) || num < 1 || num > 1000) {
        return Response.json(
          createValidationError('limit', VALIDATION_ERRORS.FIELD_INVALID_FORMAT.code, limitParam),
          { status: 400 },
        );
      }
    }
    const limit = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 1000);
    const prefix = url.searchParams.get('prefix')?.trim() || '';
    const search = url.searchParams.get('search')?.trim().toLowerCase() || '';

    let r2Cursor: string | undefined = undefined;
    let skipCount = 0;
    if (requestCursor) {
      try {
        const decoded = JSON.parse(requestCursor) as { r2Cursor?: string; skipCount?: number };
        r2Cursor = decoded.r2Cursor;
        skipCount = Math.max(0, decoded.skipCount || 0);
        if (!r2Cursor) skipCount = 0;
      } catch {
        r2Cursor = requestCursor;
        skipCount = 0;
      }
    }

    const PROCESSING_CAP = 10000;
    const matchingObjects: StorageDoc[] = [];
    let currentCursor = r2Cursor;
    let objectsProcessed = 0;
    let truncated = false;
    let listedTruncated = false;

    while (matchingObjects.length < skipCount + limit && objectsProcessed < PROCESSING_CAP) {
      const listOptions: { limit: number; prefix?: string; cursor?: string } = {
        limit: 1000,
        prefix: prefix || undefined,
      };
      if (currentCursor) listOptions.cursor = currentCursor;

      const listed = await env.PDF_BUCKET.list(listOptions);

      if (listed.objects.length === 0) {
        listedTruncated = false;
        break;
      }

      objectsProcessed += listed.objects.length;

      for (const obj of listed.objects) {
        const parsed = parseKey(obj.key);
        if (!parsed) continue;
        if (search && !parsed.fileName.toLowerCase().includes(search)) continue;

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

      if (listed.truncated) {
        currentCursor = listed.cursor;
        listedTruncated = true;
      } else {
        listedTruncated = false;
        break;
      }

      if (objectsProcessed >= PROCESSING_CAP) {
        truncated = true;
        break;
      }
    }

    skipCount = Math.min(skipCount, matchingObjects.length);
    const paginatedObjects = matchingObjects.slice(skipCount, skipCount + limit);

    const db = createDb(env.DB);
    const trackedKeys = await db.select({ bucketKey: mediaFiles.bucketKey }).from(mediaFiles);
    const trackedKeysSet = new Set(trackedKeys.map(row => row.bucketKey));

    const documentsWithOrphanStatus = paginatedObjects.map(doc => ({
      ...doc,
      orphaned: !trackedKeysSet.has(doc.key),
    }));

    const response: {
      documents: typeof documentsWithOrphanStatus;
      limit: number;
      nextCursor?: string;
      truncated?: boolean;
    } = {
      documents: documentsWithOrphanStatus,
      limit,
    };

    const hasMoreR2Objects = listedTruncated && currentCursor;
    const canContinueAfterCap = truncated && currentCursor;

    if (hasMoreR2Objects || canContinueAfterCap) {
      const nextSkipCount = Math.max(0, skipCount + paginatedObjects.length);
      response.nextCursor = JSON.stringify({
        r2Cursor: currentCursor,
        skipCount: nextSkipCount,
      });
    }

    if (truncated) response.truncated = true;

    return Response.json(response, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error listing storage documents:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'list_storage_documents',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const handleDelete = async ({ request }: { request: Request }) => {
  let body: { keys?: unknown };
  try {
    body = (await request.json()) as { keys?: unknown };
  } catch {
    return Response.json(
      createValidationError('body', VALIDATION_ERRORS.FIELD_INVALID_FORMAT.code, null, 'json'),
      { status: 400 },
    );
  }

  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    return Response.json(
      createValidationError('keys', VALIDATION_ERRORS.FIELD_REQUIRED.code, null, 'min_length_1'),
      { status: 400 },
    );
  }

  for (const k of body.keys) {
    if (typeof k !== 'string' || !R2_KEY_PATTERN.test(k)) {
      return Response.json(
        createValidationError('keys', VALIDATION_ERRORS.FIELD_INVALID_FORMAT.code, k, 'r2_key'),
        { status: 400 },
      );
    }
  }

  const keys = body.keys as string[];

  try {
    const deleteResults = await Promise.allSettled(keys.map(key => env.PDF_BUCKET.delete(key)));

    const deleted = deleteResults.filter(r => r.status === 'fulfilled').length;
    const failed = deleteResults.filter(r => r.status === 'rejected').length;

    let errors: Array<{ key: string; error: string }> | undefined;
    if (failed > 0) {
      errors = [];
      deleteResults.forEach((result, i) => {
        if (result.status === 'rejected') {
          errors!.push({
            key: keys[i],
            error: (result.reason as Error)?.message || 'Unknown error',
          });
        }
      });
    }

    return Response.json({ deleted, failed, errors }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error deleting storage documents:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'delete_storage_documents',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/storage/documents')({
  server: {
    middleware: [adminMiddleware],
    handlers: { GET: handleGet, DELETE: handleDelete },
  },
});
